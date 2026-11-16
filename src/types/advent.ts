export type CardType =
  | "polaroid"
  | "letter"
  | "voucher"
  | "compliment"
  | "media"
  | "map"
  | "quiz";

export type StarVisualState =
  | "locked"
  | "available_today"
  | "available_past"
  | "opened";

/** One pin on the "our map" card with the photos taken there. */
export interface MapPlace {
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly date?: string;
  readonly note?: string;
  /** One or more image paths, e.g. "./photos/karte-bodensee-1.jpg". */
  readonly photos: readonly string[];
}

/** A multiple-choice question that guards the card's message. */
export interface QuizContent {
  readonly question: string;
  readonly options: readonly string[];
  readonly correctIndex: number;
  readonly wrongHint?: string;
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
}
