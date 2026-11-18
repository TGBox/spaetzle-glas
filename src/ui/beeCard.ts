import {
  type BeeGuessResult,
  evaluateBeeGuess,
  getBeeLetters,
  getBeeMaxScore,
  getBeeScore,
  isBeeSolved,
  maskBeeWord,
  normalizeBeeWord,
} from "../domain/beeRules";
import type { BeePuzzle } from "../types/advent";
import { escapeHtml } from "./html";

export type BeeFeedbackTone = "good" | "special" | "pangram" | "miss";

/** UI state of one puzzle that must survive re-renders of the card. */
export interface BeeSession {
  /** Tile indices in the order they were tapped. */
  input: number[];
  /** Tile indices shown around the center, in display order. */
  outerOrder: number[];
  feedback: { readonly text: string; readonly tone: BeeFeedbackTone } | null;
  showHints: boolean;
  /** Set when a guess solves the puzzle, so the card can scroll to the message. */
  scrollToReveal: boolean;
}

export interface BeeBoardCallbacks {
  /** A listed word was found; the caller persists it and re-renders the card. */
  readonly onWordFound: (
    result: Extract<BeeGuessResult, { kind: "found" }>,
    solvesPuzzle: boolean
  ) => void;
  /** A guess was rejected (for sound and haptics). */
  readonly onMiss: () => void;
}

/** Radius of the outer ring of tiles relative to the board size. */
const RING_RADIUS_PERCENT = 34;

function findCenterIndex(letters: readonly string[], center: string): number {
  return Math.max(0, letters.indexOf(normalizeBeeWord(center)));
}

/**
 * Creates the initial UI session for a puzzle (outer tiles in their given order).
 */
export function createBeeSession(puzzle: BeePuzzle): BeeSession {
  const letters = getBeeLetters(puzzle);
  const centerIndex = findCenterIndex(letters, puzzle.center);
  return {
    input: [],
    outerOrder: letters.map((_, index) => index).filter((index) => index !== centerIndex),
    feedback: null,
    showHints: false,
    scrollToReveal: false,
  };
}

function praiseForPoints(points: number): string {
  if (points >= 6) {
    return "Super!";
  }
  if (points >= 4) {
    return "Prima!";
  }
  return "Gut!";
}

function sortWords(words: readonly string[]): string[] {
  return [...words].sort((a, b) => a.localeCompare(b, "de"));
}

/**
 * Interactive Buchstabiene board: nine hexagonal tiles, the current input,
 * Löschen / Mischen / Eingabe, a score bar, found words and optional hints.
 */
export class BeeBoard {
  private readonly root: HTMLElement;
  private readonly puzzle: BeePuzzle;
  private readonly session: BeeSession;
  private readonly callbacks: BeeBoardCallbacks;
  private readonly letters: string[];
  private readonly centerIndex: number;
  private readonly specialWords: Set<string>;
  private found: readonly string[] = [];

  constructor(
    root: HTMLElement,
    puzzle: BeePuzzle,
    session: BeeSession,
    callbacks: BeeBoardCallbacks
  ) {
    this.root = root;
    this.puzzle = puzzle;
    this.session = session;
    this.callbacks = callbacks;
    this.letters = getBeeLetters(puzzle);
    this.centerIndex = findCenterIndex(this.letters, puzzle.center);
    this.specialWords = new Set(
      puzzle.words
        .filter((entry) => entry.special)
        .map((entry) => normalizeBeeWord(entry.word))
    );
    this.root.addEventListener("click", this.handleClick);
  }

  public render(found: readonly string[]): void {
    this.found = found.map(normalizeBeeWord);
    const score = getBeeScore(this.puzzle, this.found);
    const maxScore = Math.max(1, getBeeMaxScore(this.puzzle));
    const remaining = this.puzzle.words.length - this.found.length;
    const feedback = this.session.feedback;

    this.root.innerHTML = `
      <div class="bee-score">
        <div class="bee-score-track"><div class="bee-score-fill" style="transform:scaleX(${(score / maxScore).toFixed(3)})"></div></div>
        <span class="bee-score-label">${score} / ${maxScore} Punkte</span>
      </div>

      <div class="bee-input js-bee-input" aria-live="polite">${this.renderInput()}</div>
      <p class="bee-feedback${feedback ? ` is-${feedback.tone}` : ""}" role="status">${feedback ? escapeHtml(feedback.text) : "&nbsp;"}</p>

      <div class="bee-hive">${this.renderTiles()}</div>

      <div class="bee-controls">
        <button type="button" class="bee-control" data-action="delete">Löschen</button>
        <button type="button" class="bee-control" data-action="shuffle" aria-label="Buchstaben mischen">Mischen</button>
        <button type="button" class="bee-control is-primary" data-action="submit">Eingabe</button>
      </div>

      <div class="bee-found">
        <div class="bee-found-head">
          <span>${this.found.length === 1 ? "1 Wort" : `${this.found.length} Wörter`} gefunden</span>
          <button type="button" class="text-btn bee-hint-toggle" data-action="hints">${this.session.showHints ? "Tipps ausblenden" : `Tipp (noch ${remaining})`}</button>
        </div>
        ${this.renderHints()}
        <div class="bee-found-list">${this.renderFoundWords()}</div>
      </div>
    `;
  }

  /** Handles physical keyboard input (Mac). Returns true if the key was used. */
  public handleKey(event: KeyboardEvent): boolean {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return false;
    }
    if (event.key === "Enter") {
      this.submit();
      return true;
    }
    if (event.key === "Backspace") {
      this.deleteLast();
      return true;
    }
    if (event.key === " ") {
      this.shuffle();
      return true;
    }
    if (Array.from(event.key).length !== 1) {
      return false;
    }

    const letter = normalizeBeeWord(event.key);
    const tileIndex = this.letters.findIndex(
      (candidate, index) =>
        candidate === letter && !this.session.input.includes(index)
    );
    if (tileIndex < 0) {
      return false;
    }
    this.addTile(tileIndex);
    return true;
  }

  private renderInput(): string {
    if (this.session.input.length === 0) {
      return `<span class="bee-input-placeholder">Tippe Buchstaben an</span>`;
    }
    return this.session.input
      .map((index) => {
        const isCenter = index === this.centerIndex;
        return `<span class="bee-input-letter${isCenter ? " is-center" : ""}">${escapeHtml(this.letters[index])}</span>`;
      })
      .join("");
  }

  private renderTiles(): string {
    const tile = (index: number, left: number, top: number): string => {
      const used = this.session.input.includes(index);
      const isCenter = index === this.centerIndex;
      return `<button type="button" class="bee-tile${isCenter ? " is-center" : ""}${used ? " is-used" : ""}" data-tile="${index}" style="left:${left.toFixed(2)}%;top:${top.toFixed(2)}%" ${used ? "disabled" : ""}>${escapeHtml(this.letters[index])}</button>`;
    };

    const outer = this.session.outerOrder.map((index, position) => {
      const angle = (position / this.session.outerOrder.length) * Math.PI * 2 - Math.PI / 2;
      return tile(
        index,
        50 + Math.cos(angle) * RING_RADIUS_PERCENT,
        50 + Math.sin(angle) * RING_RADIUS_PERCENT
      );
    });
    return `${outer.join("")}${tile(this.centerIndex, 50, 50)}`;
  }

  private renderFoundWords(): string {
    if (this.found.length === 0) {
      return `<span class="bee-found-empty">Noch nichts gefunden</span>`;
    }
    return sortWords(this.found)
      .map((word) => {
        const isSpecial = this.specialWords.has(word);
        return isSpecial
          ? `<button type="button" class="bee-word is-special" data-word="${escapeHtml(word)}">${escapeHtml(word)}</button>`
          : `<span class="bee-word">${escapeHtml(word)}</span>`;
      })
      .join("");
  }

  private renderHints(): string {
    if (!this.session.showHints) {
      return "";
    }
    const foundSet = new Set(this.found);
    const open = this.puzzle.words
      .map((entry) => normalizeBeeWord(entry.word))
      .filter((word) => !foundSet.has(word));
    if (open.length === 0) {
      return `<p class="bee-hints-done">Alle Wörter gefunden ♥</p>`;
    }
    const specialHints = open
      .filter((word) => this.specialWords.has(word))
      .map(
        (word) =>
          `<span class="bee-hint is-special">${escapeHtml(maskBeeWord(word))}</span>`
      )
      .join("");

    // Compact grid like the original: rows = first letter, columns = word length.
    const counts = new Map<string, Map<number, number>>();
    const lengths = new Set<number>();
    for (const word of open) {
      const chars = Array.from(word);
      const first = chars[0];
      lengths.add(chars.length);
      const row = counts.get(first) ?? new Map<number, number>();
      row.set(chars.length, (row.get(chars.length) ?? 0) + 1);
      counts.set(first, row);
    }
    const columns = [...lengths].sort((a, b) => a - b);
    const rows = [...counts.keys()].sort((a, b) => a.localeCompare(b, "de"));
    const header = columns.map((length) => `<th>${length}</th>`).join("");
    const body = rows
      .map((letter) => {
        const row = counts.get(letter);
        const cells = columns
          .map((length) => `<td>${row?.get(length) ?? "·"}</td>`)
          .join("");
        return `<tr><th>${escapeHtml(letter)}</th>${cells}</tr>`;
      })
      .join("");

    return `
      ${specialHints ? `<div class="bee-hints"><span class="bee-hints-label">Unsere Wörter:</span>${specialHints}</div>` : ""}
      <p class="bee-hints-label">Noch offen nach Anfangsbuchstabe und Länge:</p>
      <table class="bee-hint-table"><thead><tr><th></th>${header}</tr></thead><tbody>${body}</tbody></table>
    `;
  }

  private readonly handleClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLElement>("button");
    if (!button || !this.root.contains(button)) {
      return;
    }

    if (button.dataset.tile !== undefined) {
      this.addTile(Number(button.dataset.tile));
      return;
    }
    if (button.dataset.word !== undefined) {
      this.showNoteFor(button.dataset.word);
      return;
    }

    switch (button.dataset.action) {
      case "delete":
        this.deleteLast();
        break;
      case "shuffle":
        this.shuffle();
        break;
      case "submit":
        this.submit();
        break;
      case "hints":
        this.session.showHints = !this.session.showHints;
        this.render(this.found);
        break;
    }
  };

  private addTile(index: number): void {
    if (this.session.input.includes(index)) {
      return;
    }
    this.session.input.push(index);
    this.session.feedback = null;
    this.render(this.found);
  }

  private deleteLast(): void {
    this.session.input.pop();
    this.session.feedback = null;
    this.render(this.found);
  }

  private shuffle(): void {
    const order = this.session.outerOrder;
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    this.render(this.found);
  }

  private showNoteFor(word: string): void {
    const entry = this.puzzle.words.find(
      (candidate) => normalizeBeeWord(candidate.word) === word
    );
    this.session.feedback = {
      text: entry?.note ?? "Eins von unseren Wörtern ✨",
      tone: "special",
    };
    this.render(this.found);
  }

  private submit(): void {
    const guess = this.session.input.map((index) => this.letters[index]).join("");
    if (guess.length === 0) {
      return;
    }

    const result = evaluateBeeGuess(this.puzzle, guess, this.found);
    if (result.kind !== "found") {
      this.session.feedback = { text: this.describeMiss(result), tone: "miss" };
      // Keep a word that was already found visible, otherwise clear the input.
      this.session.input = result.kind === "too_short" ? this.session.input : [];
      this.render(this.found);
      this.root
        .querySelector(".js-bee-input")
        ?.classList.add("is-shaking");
      this.callbacks.onMiss();
      return;
    }

    const entry = this.puzzle.words.find(
      (candidate) => normalizeBeeWord(candidate.word) === result.word
    );
    const solvesPuzzle =
      !isBeeSolved(this.puzzle, this.found) &&
      isBeeSolved(this.puzzle, [...this.found, result.word]);

    this.session.input = [];
    this.session.scrollToReveal = solvesPuzzle;
    this.session.feedback = result.isPangram
      ? { text: `Pangramm! +${result.points} ✨`, tone: "pangram" }
      : result.isSpecial
        ? {
            text: `${entry?.note ?? "Eins von unseren Wörtern ✨"} +${result.points}`,
            tone: "special",
          }
        : { text: `${praiseForPoints(result.points)} +${result.points}`, tone: "good" };

    this.callbacks.onWordFound(result, solvesPuzzle);
  }

  private describeMiss(result: BeeGuessResult): string {
    switch (result.kind) {
      case "too_short":
        return "Zu kurz – mindestens 3 Buchstaben";
      case "missing_center":
        return `Das ${normalizeBeeWord(this.puzzle.center)} in der Mitte fehlt`;
      case "invalid_letters":
        return "Diese Buchstaben gibt es nicht so oft";
      case "already_found":
        return "Schon gefunden";
      case "not_in_list":
        return "Nicht auf meiner Liste 😉";
      case "found":
        return "";
    }
  }
}
