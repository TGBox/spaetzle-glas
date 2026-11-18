import type { BeePuzzle } from "../types/advent";

/** Words shorter than this never count (same as the original Buchstabiene). */
export const MIN_BEE_WORD_LENGTH = 3;
const PANGRAM_POINTS = 12;

export type BeeGuessResult =
  | { readonly kind: "too_short" }
  | { readonly kind: "missing_center" }
  | { readonly kind: "invalid_letters" }
  | { readonly kind: "already_found" }
  | { readonly kind: "not_in_list" }
  | {
      readonly kind: "found";
      readonly word: string;
      readonly points: number;
      readonly isPangram: boolean;
      readonly isSpecial: boolean;
    };

/**
 * Uppercases a word letter by letter. `String.prototype.toUpperCase` would turn
 * "ß" into "SS", which would break the letter count, so ß (and capital ẞ) stay ß.
 */
export function normalizeBeeWord(input: string): string {
  return Array.from(input.trim())
    .map((char) => (char === "ß" || char === "ẞ" ? "ß" : char.toUpperCase()))
    .join("");
}

/** Splits the puzzle's letter string into single, normalized letters. */
export function getBeeLetters(puzzle: BeePuzzle): string[] {
  return Array.from(normalizeBeeWord(puzzle.letters));
}

function countLetters(letters: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const letter of letters) {
    counts.set(letter, (counts.get(letter) ?? 0) + 1);
  }
  return counts;
}

/**
 * True when `word` can be spelled with the puzzle letters,
 * using each tile at most once (a letter that appears twice may be used twice).
 */
export function canSpellWithLetters(word: string, letters: readonly string[]): boolean {
  const available = countLetters(letters);
  for (const letter of Array.from(normalizeBeeWord(word))) {
    const remaining = available.get(letter) ?? 0;
    if (remaining <= 0) {
      return false;
    }
    available.set(letter, remaining - 1);
  }
  return true;
}

/** True when the word uses every tile exactly once. */
export function isBeePangram(word: string, letters: readonly string[]): boolean {
  return (
    Array.from(normalizeBeeWord(word)).length === letters.length &&
    canSpellWithLetters(word, letters)
  );
}

/**
 * Points as in the Buchstabiene: 3 letters = 2, 4 letters = 3,
 * pangram = 12, otherwise one point per letter.
 */
export function scoreBeeWord(word: string, letters: readonly string[]): number {
  const length = Array.from(normalizeBeeWord(word)).length;
  if (isBeePangram(word, letters)) {
    return PANGRAM_POINTS;
  }
  if (length === 3) {
    return 2;
  }
  if (length === 4) {
    return 3;
  }
  return length;
}

/** Highest possible score: every listed word found. */
export function getBeeMaxScore(puzzle: BeePuzzle): number {
  const letters = getBeeLetters(puzzle);
  return puzzle.words.reduce(
    (sum, entry) => sum + scoreBeeWord(entry.word, letters),
    0
  );
}

/** Current score for the words found so far. */
export function getBeeScore(puzzle: BeePuzzle, found: readonly string[]): number {
  const letters = getBeeLetters(puzzle);
  return found.reduce((sum, word) => sum + scoreBeeWord(word, letters), 0);
}

/**
 * Checks a guess against the rules and the puzzle's word list.
 * Rule violations are reported before "not in list" so feedback can be specific.
 */
export function evaluateBeeGuess(
  puzzle: BeePuzzle,
  guess: string,
  found: readonly string[]
): BeeGuessResult {
  const word = normalizeBeeWord(guess);
  const letters = getBeeLetters(puzzle);
  const center = normalizeBeeWord(puzzle.center);

  if (Array.from(word).length < MIN_BEE_WORD_LENGTH) {
    return { kind: "too_short" };
  }
  if (!word.includes(center)) {
    return { kind: "missing_center" };
  }
  if (!canSpellWithLetters(word, letters)) {
    return { kind: "invalid_letters" };
  }
  if (found.some((entry) => normalizeBeeWord(entry) === word)) {
    return { kind: "already_found" };
  }

  const entry = puzzle.words.find(
    (candidate) => normalizeBeeWord(candidate.word) === word
  );
  if (!entry) {
    return { kind: "not_in_list" };
  }

  return {
    kind: "found",
    word,
    points: scoreBeeWord(word, letters),
    isPangram: isBeePangram(word, letters),
    isSpecial: Boolean(entry.special),
  };
}

/**
 * The card's message opens once a pangram is found, or, for puzzles without
 * a pangram, once every special ("our") word has been found.
 */
export function isBeeSolved(puzzle: BeePuzzle, found: readonly string[]): boolean {
  const letters = getBeeLetters(puzzle);
  const foundSet = new Set(found.map(normalizeBeeWord));
  const pangrams = puzzle.words.filter((entry) =>
    isBeePangram(entry.word, letters)
  );

  if (pangrams.length > 0) {
    return pangrams.some((entry) => foundSet.has(normalizeBeeWord(entry.word)));
  }

  const specials = puzzle.words.filter((entry) => entry.special);
  return (
    specials.length > 0 &&
    specials.every((entry) => foundSet.has(normalizeBeeWord(entry.word)))
  );
}

/**
 * Masked hint for a word that has not been found yet, e.g. "BRUST" → "B _ _ _ _".
 */
export function maskBeeWord(word: string): string {
  const chars = Array.from(normalizeBeeWord(word));
  return chars.map((char, index) => (index === 0 ? char : "_")).join(" ");
}
