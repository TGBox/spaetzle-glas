export type CardType =
  | "polaroid"
  | "letter"
  | "voucher"
  | "compliment"
  | "media"
  | "map"
  | "quiz"
  | "bee"
  | "stats";

export type StarVisualState =
  | "locked"
  | "available_today"
  | "available_past"
  | "opened";

/**
 * A photo of a map place: just the path, or the path with a short caption,
 * e.g. { url: "./photos/karte-kisslegg-1.jpg", caption: "Picknick am See" }.
 */
export type MapPhoto = string | { readonly url: string; readonly caption?: string };

/** One pin on the "our map" card with the photos taken there. */
export interface MapPlace {
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly date?: string;
  readonly note?: string;
  /** One or more image paths, e.g. "./photos/karte-bodensee-1.jpg". */
  readonly photos: readonly MapPhoto[];
}

/** A multiple-choice question that guards the card's message. */
export interface QuizContent {
  readonly question: string;
  readonly options: readonly string[];
  readonly correctIndex: number;
  readonly wrongHint?: string;
}

/** One accepted word of a Buchstabiene puzzle. */
export interface BeeWord {
  readonly word: string;
  /** "Our" words glow golden when found and unlock puzzles without a pangram. */
  readonly special?: boolean;
  /** Short line shown when a special word is found ("why this word matters"). */
  readonly note?: string;
}

/** One tile of the "our relationship in numbers" card. */
export interface StatItem {
  /** The big number, already formatted (e.g. "127.320"). */
  readonly value: string;
  readonly label: string;
  /** Optional small line under the label. */
  readonly note?: string;
}

/** A Buchstabiene / Spelling Bee puzzle with a fixed, hand-picked word list. */
export interface BeePuzzle {
  /** The nine tiles, duplicates allowed (e.g. "STRAßBURG" has two R). */
  readonly letters: string;
  /** The center tile; every word must contain it. */
  readonly center: string;
  readonly words: readonly BeeWord[];
}

export interface AdventDay {
  readonly day: number;
  readonly title: string;
  readonly type: CardType;
  readonly yearBadge: string;
  readonly message: string;
  readonly subtitle?: string;
  readonly photoUrl?: string;
  readonly photoCaption?: string;
  readonly voucherCode?: string;
  readonly complimentHighlight?: string;
  readonly audioUrl?: string;
  readonly videoUrl?: string;
  readonly videoPosterUrl?: string;
  readonly mediaCaption?: string;
  readonly places?: readonly MapPlace[];
  readonly quiz?: QuizContent;
  readonly bee?: BeePuzzle;
  readonly stats?: readonly StatItem[];
}

export interface PersistedAppState {
  readonly unlockedJar: boolean;
  readonly openedDays: readonly number[];
  readonly redeemedVouchers: Readonly<Record<number, string>>;
  readonly muted: boolean;
  /** Voucher days whose scratch-off foil has been rubbed away. */
  readonly scratchedVouchers: readonly number[];
  /** Quiz days that have been answered correctly. */
  readonly solvedQuizzes: readonly number[];
  /** Words found per Buchstabiene day. */
  readonly beeFoundWords: Readonly<Record<number, readonly string[]>>;
}
