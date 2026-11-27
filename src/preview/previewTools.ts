/**
 * Test helpers for `?preview=true`: simulate any calendar day and jump between cards.
 * Nothing here is visible without the preview parameter.
 */

const ADVENT_YEAR = 2026;
/** 0 = 30 November (before the first star), 25 = 25 December (after the last one). */
export const PREVIEW_MIN_DAY = 0;
export const PREVIEW_MAX_DAY = 25;

/** Reads `&day=7` from the URL; null means "use the real date". */
export function readPreviewDay(search: string): number | null {
  const raw = new URLSearchParams(search).get("day");
  if (raw === null || raw.trim() === "") {
    return null;
  }
  const day = Number(raw);
  return Number.isInteger(day) && day >= PREVIEW_MIN_DAY && day <= PREVIEW_MAX_DAY
    ? day
    : null;
}

/** The simulated "now": the chosen day at the real time of day. */
export function simulatedDate(day: number, real: Date = new Date()): Date {
  const date = new Date(real);
  if (day === 0) {
    date.setFullYear(ADVENT_YEAR, 10, 30);
  } else {
    date.setFullYear(ADVENT_YEAR, 11, day);
  }
  return date;
}

export function formatPreviewDay(day: number | null): string {
  if (day === null) {
    return "Echtes Datum";
  }
  if (day === 0) {
    return "30. November";
  }
  return `${day}. Dezember`;
}

export interface PreviewBarHandlers {
  readonly onSetDay: (day: number | null) => void;
  readonly onShiftDay: (delta: number) => void;
  readonly onToggleAll: () => void;
  readonly onReset: () => void;
}

/** Small toolbar pinned to the top of the screen while previewing. */
export class PreviewBar {
  private readonly element: HTMLElement;
  private readonly select: HTMLSelectElement;
  private readonly allToggle: HTMLInputElement;

  constructor(handlers: PreviewBarHandlers) {
    this.element = document.createElement("div");
    this.element.className = "preview-bar";
    const options = [`<option value="">${formatPreviewDay(null)}</option>`];
    for (let day = PREVIEW_MIN_DAY; day <= PREVIEW_MAX_DAY; day++) {
      options.push(`<option value="${day}">${formatPreviewDay(day)}</option>`);
    }
    this.element.innerHTML = `
      <span class="preview-bar-tag">Vorschau</span>
      <button type="button" class="preview-bar-btn js-preview-prev" title="Einen Tag zurück">‹<span class="preview-bar-long"> Tag</span></button>
      <select class="preview-bar-select js-preview-day" aria-label="Simuliertes Datum">${options.join("")}</select>
      <button type="button" class="preview-bar-btn js-preview-next" title="Der nächste Tag beginnt"><span class="preview-bar-long">Nächster Tag </span>›</button>
      <label class="preview-bar-toggle"><input type="checkbox" class="js-preview-all" /> Alle offen</label>
      <button type="button" class="preview-bar-btn js-preview-reset" title="Geöffnete Sterne, Rubbelfelder und Rätsel der Vorschau zurücksetzen">↺<span class="preview-bar-long"> Zurücksetzen</span></button>
    `;
    this.select = this.element.querySelector<HTMLSelectElement>(".js-preview-day")!;
    this.allToggle = this.element.querySelector<HTMLInputElement>(".js-preview-all")!;

    this.element
      .querySelector(".js-preview-prev")
      ?.addEventListener("click", () => handlers.onShiftDay(-1));
    this.element
      .querySelector(".js-preview-next")
      ?.addEventListener("click", () => handlers.onShiftDay(1));
    this.select.addEventListener("change", () => {
      handlers.onSetDay(this.select.value === "" ? null : Number(this.select.value));
    });
    this.allToggle.addEventListener("change", () => handlers.onToggleAll());
    this.element
      .querySelector(".js-preview-reset")
      ?.addEventListener("click", () => handlers.onReset());

    document.body.appendChild(this.element);
  }

  public update(day: number | null, previewAll: boolean): void {
    this.select.value = day === null ? "" : String(day);
    this.allToggle.checked = previewAll;
  }
}
