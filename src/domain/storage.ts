import type { PersistedAppState } from "../types/advent";

const STORAGE_KEY = "spaetzle-glas-state-v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const memoryFallbackStore = new Map<string, string>();

const memoryStorage: StorageLike = {
  getItem: (key) => memoryFallbackStore.get(key) ?? null,
  setItem: (key, value) => {
    memoryFallbackStore.set(key, value);
  },
};

function getDefaultStorage(): StorageLike {
  try {
    if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
      return globalThis.localStorage;
    }
  } catch {
    // Fallback when storage access is denied (e.g., strict privacy settings).
  }
  return memoryStorage;
}

export function createDefaultAppState(): PersistedAppState {
  return {
    unlockedJar: false,
    openedDays: [],
    redeemedVouchers: {},
    muted: false,
    scratchedVouchers: [],
    solvedQuizzes: [],
    beeFoundWords: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeDayList(raw: unknown): number[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const unique = new Set<number>();
  for (const item of raw) {
    if (
      typeof item === "number" &&
      Number.isInteger(item) &&
      item >= 1 &&
      item <= 24
    ) {
      unique.add(item);
    }
  }
  return Array.from(unique).sort((a, b) => a - b);
}

function sanitizeBeeFoundWords(raw: unknown): Record<number, string[]> {
  if (!isRecord(raw)) {
    return {};
  }
  const result: Record<number, string[]> = {};
  for (const [key, val] of Object.entries(raw)) {
    const day = Number(key);
    if (!Number.isInteger(day) || day < 1 || day > 24 || !Array.isArray(val)) {
      continue;
    }
    const words = val.filter(
      (item): item is string => typeof item === "string" && item.length > 0
    );
    result[day] = Array.from(new Set(words));
  }
  return result;
}

function sanitizeRedeemedVouchers(raw: unknown): Record<number, string> {
  if (!isRecord(raw)) {
    return {};
  }
  const result: Record<number, string> = {};
  for (const [key, val] of Object.entries(raw)) {
    const day = Number(key);
    if (
      Number.isInteger(day) &&
      day >= 1 &&
      day <= 24 &&
      typeof val === "string" &&
      val.length > 0
    ) {
      result[day] = val;
    }
  }
  return result;
}

export function loadAppState(
  storage: StorageLike = getDefaultStorage()
): PersistedAppState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultAppState();
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return createDefaultAppState();
    }

    return {
      unlockedJar: Boolean(parsed.unlockedJar),
      openedDays: sanitizeDayList(parsed.openedDays),
      redeemedVouchers: sanitizeRedeemedVouchers(parsed.redeemedVouchers),
      muted: Boolean(parsed.muted),
      scratchedVouchers: sanitizeDayList(parsed.scratchedVouchers),
      solvedQuizzes: sanitizeDayList(parsed.solvedQuizzes),
      beeFoundWords: sanitizeBeeFoundWords(parsed.beeFoundWords),
    };
  } catch {
    return createDefaultAppState();
  }
}

export function saveAppState(
  state: PersistedAppState,
  storage: StorageLike = getDefaultStorage()
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    memoryStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

export function setJarUnlockedState(
  state: PersistedAppState,
  unlockedJar: boolean,
  storage: StorageLike = getDefaultStorage()
): PersistedAppState {
  const next: PersistedAppState = {
    ...state,
    unlockedJar,
  };
  saveAppState(next, storage);
  return next;
}

export function markDayOpened(
  state: PersistedAppState,
  day: number,
  storage: StorageLike = getDefaultStorage()
): PersistedAppState {
  if (!Number.isInteger(day) || day < 1 || day > 24) {
    return state;
  }
  if (state.openedDays.includes(day)) {
    return state;
  }

  const next: PersistedAppState = {
    ...state,
    openedDays: [...state.openedDays, day].sort((a, b) => a - b),
  };
  saveAppState(next, storage);
  return next;
}

function isValidDay(day: number): boolean {
  return Number.isInteger(day) && day >= 1 && day <= 24;
}

/**
 * Remembers that the scratch-off foil of a voucher day has been rubbed away.
 */
export function markVoucherScratched(
  state: PersistedAppState,
  day: number,
  storage: StorageLike = getDefaultStorage()
): PersistedAppState {
  if (!isValidDay(day) || state.scratchedVouchers.includes(day)) {
    return state;
  }
  const next: PersistedAppState = {
    ...state,
    scratchedVouchers: [...state.scratchedVouchers, day].sort((a, b) => a - b),
  };
  saveAppState(next, storage);
  return next;
}

/**
 * Remembers that the quiz of a day has been answered correctly.
 */
export function markQuizSolved(
  state: PersistedAppState,
  day: number,
  storage: StorageLike = getDefaultStorage()
): PersistedAppState {
  if (!isValidDay(day) || state.solvedQuizzes.includes(day)) {
    return state;
  }
  const next: PersistedAppState = {
    ...state,
    solvedQuizzes: [...state.solvedQuizzes, day].sort((a, b) => a - b),
  };
  saveAppState(next, storage);
  return next;
}

/**
 * Adds a found Buchstabiene word for a day (ignores duplicates).
 */
export function addBeeFoundWord(
  state: PersistedAppState,
  day: number,
  word: string,
  storage: StorageLike = getDefaultStorage()
): PersistedAppState {
  const existing = state.beeFoundWords[day] ?? [];
  if (!isValidDay(day) || word.length === 0 || existing.includes(word)) {
    return state;
  }
  const next: PersistedAppState = {
    ...state,
    beeFoundWords: { ...state.beeFoundWords, [day]: [...existing, word] },
  };
  saveAppState(next, storage);
  return next;
}

export function formatGermanRedeemDate(now: Date): string {
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  return `${day}.${month}.${year}`;
}

export function redeemVoucherDay(
  state: PersistedAppState,
  day: number,
  now: Date = new Date(),
  storage: StorageLike = getDefaultStorage()
): PersistedAppState {
  if (!Number.isInteger(day) || day < 1 || day > 24) {
    return state;
  }

  if (state.redeemedVouchers[day]) {
    return state;
  }

  const next: PersistedAppState = {
    ...state,
    redeemedVouchers: {
      ...state.redeemedVouchers,
      [day]: formatGermanRedeemDate(now),
    },
  };
  saveAppState(next, storage);
  return next;
}

export function setMutedState(
  state: PersistedAppState,
  muted: boolean,
  storage: StorageLike = getDefaultStorage()
): PersistedAppState {
  const next: PersistedAppState = {
    ...state,
    muted,
  };
  saveAppState(next, storage);
  return next;
}
