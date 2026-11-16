export type CardType =
  | "polaroid"
  | "letter"
  | "voucher"
  | "compliment"
  | "media";

export type StarVisualState =
  | "locked"
  | "available_today"
  | "available_past"
  | "opened";

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
}

export interface PersistedAppState {
  readonly unlockedJar: boolean;
  readonly openedDays: readonly number[];
  readonly redeemedVouchers: Readonly<Record<number, string>>;
  readonly muted: boolean;
}
