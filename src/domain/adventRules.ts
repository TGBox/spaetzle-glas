import {
  ADVENT_DAYS,
  JAR_PASSWORDS,
  MISSED_DAY_NOTES,
} from "../data/adventDays";
import type { AdventDay, StarVisualState } from "../types/advent";

const ADVENT_YEAR = 2026;
const DECEMBER_MONTH_INDEX = 11; // JavaScript Date months are 0-based (11 === December).
const TOTAL_ADVENT_DAYS = 24;

/**
 * Validates the entered password against the configured jar passwords.
 */
export function isJarPasswordValid(input: string): boolean {
  const normalized = input.trim().replace(/\s+/g, "").toLowerCase();
  if (normalized.length === 0) {
    return false;
  }

  return JAR_PASSWORDS.some(
    (password) => password.toLowerCase() === normalized
  );
}

/**
 * Checks whether a given advent calendar day (1..24) is unlocked at `now`.
 * Unlocks in December 2026 when `day <= now.getDate()`, permanently after Dec 2026,
 * or unconditionally when `previewAll` is enabled.
 */
export function isDayUnlocked(
  day: number,
  now: Date,
  previewAll: boolean
): boolean {
  if (!Number.isInteger(day) || day < 1 || day > TOTAL_ADVENT_DAYS) {
    return false;
  }

  if (previewAll) {
    return true;
  }

  const year = now.getFullYear();
  if (year > ADVENT_YEAR) {
    return true;
  }
  if (year < ADVENT_YEAR) {
    return false;
  }

  const month = now.getMonth();
  if (month < DECEMBER_MONTH_INDEX) {
    return false;
  }

  // December 2026: unlock up to the current day of the month.
  return day <= now.getDate();
}

/**
 * Determines which day (1..24) should be highlighted as "today's star".
 * During Dec 1..24, 2026 this is `now.getDate()`. In preview mode outside Dec 1..24,
 * it points to the lowest unopened day so the author can test the today highlight.
 */
export function getActiveTodayDay(
  now: Date,
  openedDays: ReadonlySet<number>,
  previewAll: boolean
): number | null {
  if (
    now.getFullYear() === ADVENT_YEAR &&
    now.getMonth() === DECEMBER_MONTH_INDEX
  ) {
    const date = now.getDate();
    if (date >= 1 && date <= TOTAL_ADVENT_DAYS) {
      return date;
    }
    return null;
  }

  if (previewAll) {
    for (let day = 1; day <= TOTAL_ADVENT_DAYS; day++) {
      if (!openedDays.has(day)) {
        return day;
      }
    }
    return TOTAL_ADVENT_DAYS;
  }

  return null;
}

/**
 * Computes the visual state of a star inside the jar for styling and interaction.
 */
export function getStarVisualState(
  day: number,
  openedDays: ReadonlySet<number>,
  now: Date,
  previewAll: boolean
): StarVisualState {
  if (!isDayUnlocked(day, now, previewAll)) {
    return "locked";
  }

  if (openedDays.has(day)) {
    return "opened";
  }

  const todayDay = getActiveTodayDay(now, openedDays, previewAll);
  if (todayDay !== null && day === todayDay) {
    return "available_today";
  }

  return "available_past";
}

/**
 * Checks whether the Christmas Eve Snowglobe & Constellation Finale is active.
 */
export function isFinaleUnlocked(
  openedDays: ReadonlySet<number>,
  now: Date,
  previewAll: boolean
): boolean {
  if (!isDayUnlocked(TOTAL_ADVENT_DAYS, now, previewAll)) {
    return false;
  }

  return (
    openedDays.has(TOTAL_ADVENT_DAYS) || openedDays.size >= TOTAL_ADVENT_DAYS
  );
}

/**
 * Looks up the AdventDay metadata for a given day number (1..24).
 */
export function getAdventDayByNumber(day: number): AdventDay | undefined {
  return ADVENT_DAYS.find((entry) => entry.day === day);
}

/**
 * True when a day's star could already have been opened on an earlier date,
 * i.e. it is unlocked but it is no longer "its" day.
 */
export function isDayMissed(day: number, now: Date): boolean {
  if (!isDayUnlocked(day, now, false)) {
    return false;
  }
  const isAdventMonth =
    now.getFullYear() === ADVENT_YEAR && now.getMonth() === DECEMBER_MONTH_INDEX;
  return !isAdventMonth || now.getDate() > day;
}

/**
 * Returns the teasing note for a star that is opened late, or null when it is on time.
 */
export function getMissedDayNote(day: number, now: Date): string | null {
  if (!isDayMissed(day, now) || MISSED_DAY_NOTES.length === 0) {
    return null;
  }
  const template = MISSED_DAY_NOTES[day % MISSED_DAY_NOTES.length];
  return template.replace("{day}", String(day));
}
