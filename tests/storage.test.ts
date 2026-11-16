import { describe, expect, it } from "vitest";
import {
  createDefaultAppState,
  formatGermanRedeemDate,
  loadAppState,
  markDayOpened,
  markQuizSolved,
  markVoucherScratched,
  redeemVoucherDay,
  setJarUnlockedState,
  setMutedState,
  type StorageLike,
} from "../src/domain/storage";

function createMockStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe("storage persistence", () => {
  it("returns default state for missing or corrupted storage data", () => {
    const storage = createMockStorage();
    expect(loadAppState(storage)).toEqual(createDefaultAppState());

    storage.setItem("spaetzle-glas-state-v1", "{invalid-json");
    expect(loadAppState(storage)).toEqual(createDefaultAppState());
  });

  it("persists unlock state, opened days, redeemed vouchers, and mute preference", () => {
    const storage = createMockStorage();
    let state = loadAppState(storage);

    state = setJarUnlockedState(state, true, storage);
    state = markDayOpened(state, 5, storage);
    state = markDayOpened(state, 1, storage);
    state = markDayOpened(state, 5, storage); // duplicate ignored
    state = redeemVoucherDay(state, 3, new Date(2026, 11, 7), storage);
    state = setMutedState(state, true, storage);

    const reloaded = loadAppState(storage);
    expect(reloaded.unlockedJar).toBe(true);
    expect(reloaded.openedDays).toEqual([1, 5]);
    expect(reloaded.redeemedVouchers).toEqual({ 3: "07.12.2026" });
    expect(reloaded.muted).toBe(true);
  });

  it("persists scratched vouchers and solved quizzes and tolerates older saved states", () => {
    const storage = createMockStorage();
    let state = loadAppState(storage);

    state = markVoucherScratched(state, 7, storage);
    state = markVoucherScratched(state, 3, storage);
    state = markVoucherScratched(state, 7, storage); // duplicate ignored
    state = markQuizSolved(state, 6, storage);
    state = markQuizSolved(state, 99, storage); // out of range ignored

    const reloaded = loadAppState(storage);
    expect(reloaded.scratchedVouchers).toEqual([3, 7]);
    expect(reloaded.solvedQuizzes).toEqual([6]);

    // A state saved before these features existed has neither field.
    storage.setItem(
      "spaetzle-glas-state-v1",
      JSON.stringify({ unlockedJar: true, openedDays: [1], muted: false })
    );
    const legacy = loadAppState(storage);
    expect(legacy.scratchedVouchers).toEqual([]);
    expect(legacy.solvedQuizzes).toEqual([]);
    expect(legacy.openedDays).toEqual([1]);
  });

  it("formats German redeem dates with leading zeros", () => {
    expect(formatGermanRedeemDate(new Date(2026, 11, 3))).toBe("03.12.2026");
  });
});
