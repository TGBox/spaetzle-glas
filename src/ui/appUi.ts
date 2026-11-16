import { ADVENT_DAYS } from "../data/adventDays";
import {
  getActiveTodayDay,
  getStarVisualState,
  isJarPasswordValid,
  isFinaleUnlocked,
} from "../domain/adventRules";
import type { AdventDay, CardType, PersistedAppState, StarVisualState } from "../types/advent";

export interface UiHandlers {
  readonly onUnlockJar: () => Promise<void>;
  readonly onWakeJar: () => void;
  readonly onSelectStar: (day: number) => void;
  readonly onOpenTodayStar: () => void;
  readonly onManualShake: () => void;
  readonly onToggleConstellation: () => void;
  readonly onToggleMute: () => void;
  readonly onRedeemVoucher: (day: number) => void;
  readonly onTogglePreviewSecret: () => void;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ICON_ATTRIBUTES =
  'viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

const ICON_SOUND_ON = `<svg ${ICON_ATTRIBUTES}><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/><path d="M18 6.5a7.8 7.8 0 0 1 0 11"/></svg>`;
const ICON_SOUND_OFF = `<svg ${ICON_ATTRIBUTES}><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>`;
const ICON_CONSTELLATION = `<svg ${ICON_ATTRIBUTES}><path d="M12 20.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.9c0 5.6-7.5 10-7.5 10z"/><circle cx="12" cy="7.6" r="0.9" fill="currentColor"/><circle cx="4.5" cy="10.5" r="0.9" fill="currentColor"/><circle cx="19.5" cy="10.5" r="0.9" fill="currentColor"/><circle cx="12" cy="20.5" r="0.9" fill="currentColor"/></svg>`;
const ICON_GALLERY = `<svg ${ICON_ATTRIBUTES}><rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/></svg>`;
const JAR_EMBLEM = `<svg viewBox="0 0 64 72" width="64" height="72" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="21" y="4" width="22" height="8" rx="3"/><path d="M18 15h28"/><path d="M21 15c0 6-9 8-9 18v25a8 8 0 0 0 8 8h24a8 8 0 0 0 8-8V33c0-10-9-12-9-18"/><path d="M32 29l3.4 7.2 7.8 1-5.7 5.4 1.5 7.8L32 46.6l-7 3.8 1.5-7.8-5.7-5.4 7.8-1z" fill="currentColor" stroke="none"/></svg>`;

const TOTAL_DAYS = 24;

function getCardTypeIcon(type: CardType): string {
  switch (type) {
    case "polaroid":
      return "📸";
    case "letter":
      return "💌";
    case "voucher":
      return "🎟️";
    case "compliment":
      return "✨";
    case "media":
      return "🎬";
  }
}

function createMediaFallbackMarkup(
  kind: "video" | "audio",
  missingUrl?: string
): string {
  const icon = kind === "video" ? "🎬" : "🎧";
  const label =
    kind === "video"
      ? "Video-Erinnerung bereit für deinen Clip"
      : "Sprachnachricht / Audio bereit für deine Datei";
  const hint = missingUrl
    ? `Datei nicht gefunden: ${escapeHtml(missingUrl)}`
    : "Lege deine Audio- oder Video-Datei in public/media/ ab";

  return `
    <div class="card-media-placeholder">
      <div class="card-media-placeholder-icon">${icon}</div>
      <div class="card-media-placeholder-title">${label}</div>
      <div class="card-media-placeholder-hint">${hint}</div>
    </div>
  `;
}

function createAudioVisualizerMarkup(): string {
  const barHeights = [34, 62, 48, 86, 54, 92, 68, 42, 78, 52, 64, 38];
  const bars = barHeights
    .map(
      (height, idx) =>
        `<span class="audio-bar" style="height:${height}%;animation-delay:${(idx * 0.08).toFixed(2)}s"></span>`
    )
    .join("");
  return `<div class="card-audio-visualizer" aria-hidden="true">${bars}</div>`;
}

function createPolaroidFallbackSvg(day: number, title: string): string {
  const safeTitle = escapeHtml(title);
  return `
    <svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" role="img" aria-label="${safeTitle}">
      <defs>
        <linearGradient id="sky-${day}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1d112b"/>
          <stop offset="65%" stop-color="#4e2644"/>
          <stop offset="100%" stop-color="#d88d6b"/>
        </linearGradient>
        <radialGradient id="moon-${day}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffe8a8"/>
          <stop offset="100%" stop-color="#ffba5a" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill="url(#sky-${day})"/>
      <circle cx="290" cy="86" r="68" fill="url(#moon-${day})" opacity="0.55"/>
      <circle cx="290" cy="86" r="24" fill="#fff0c4"/>
      <circle cx="76" cy="54" r="2.2" fill="#fff5d6"/>
      <circle cx="142" cy="40" r="1.8" fill="#fff5d6"/>
      <circle cx="212" cy="64" r="2.5" fill="#ffd98a"/>
      <circle cx="110" cy="108" r="1.5" fill="#fff5d6"/>
      <circle cx="348" cy="48" r="2" fill="#fff5d6"/>
      <path d="M0 245 Q110 202 220 232 T400 218 L400 300 L0 300 Z" fill="#180d22" opacity="0.92"/>
      <path d="M185 205 C185 190 200 183 206 196 C212 183 227 190 227 205 C227 222 206 234 206 234 C206 234 185 222 185 205 Z" fill="#ffd479" opacity="0.9"/>
      <text x="20" y="278" fill="#ffe6bf" font-family="Georgia, serif" font-size="16" opacity="0.9">Tag ${day} • Erinnerung aus 5 Jahren</text>
    </svg>
  `;
}

/**
 * Manages the HTML/CSS HUD, anniversary lockscreen, 5 memory card layouts,
 * and the 24-moment gallery overlay.
 */
export class AppUi {
  private readonly root: HTMLElement;
  private readonly handlers: UiHandlers;

  public readonly canvas: HTMLCanvasElement;
  private readonly lockOverlay: HTMLElement;
  private readonly lockForm: HTMLFormElement;
  private readonly lockCard: HTMLElement;
  private readonly lockInput: HTMLInputElement;
  private readonly lockError: HTMLElement;
  private readonly wakeVeil: HTMLButtonElement;

  private readonly progressPill: HTMLElement;
  private readonly starProgress: HTMLElement;
  private readonly chargeMeter: HTMLElement;
  private readonly chargeFill: HTMLElement;
  private readonly previewPill: HTMLElement;
  private readonly finalePill: HTMLElement;
  private readonly muteButton: HTMLButtonElement;
  private readonly constellationButton: HTMLButtonElement;
  private readonly galleryButton: HTMLButtonElement;
  private readonly todayButton: HTMLButtonElement;
  private readonly shakeButton: HTMLButtonElement;
  private readonly hintText: HTMLElement;
  private readonly subtitleButton: HTMLElement;

  private readonly toastElement: HTMLElement;
  private readonly cardOverlay: HTMLElement;
  private readonly cardContainer: HTMLElement;
  private readonly galleryOverlay: HTMLElement;
  private readonly galleryContainer: HTMLElement;

  private toastTimerId: number | null = null;
  private secretTapCount = 0;
  private secretTapResetId: number | null = null;
  private currentModalDay: number | null = null;
  private sensorsLive = false;
  private hintContext: {
    readonly constellationMode: boolean;
    readonly finaleActive: boolean;
    readonly unopenedTodayDay: number | null;
  } = { constellationMode: false, finaleActive: false, unopenedTodayDay: null };

  constructor(root: HTMLElement, handlers: UiHandlers) {
    this.root = root;
    this.handlers = handlers;

    this.root.innerHTML = `
      <canvas class="scene-canvas" aria-label="Interaktives 3D-Adventsglas"></canvas>

      <div class="hud-layer">
        <div class="hud-top">
          <div class="brand-block">
            <h1 class="brand-title">Für mein Spätzle</h1>
            <p class="brand-subtitle" role="button" tabindex="0">5 Jahre wir • Advents-Glas</p>
            <div class="progress-row">
              <div class="star-progress js-star-progress" aria-hidden="true"></div>
              <span class="progress-count js-progress-pill">0 / 24</span>
            </div>
            <div class="status-pills">
              <span class="pill pill-finale js-finale-pill" hidden>Heiligabend-Schneekugel</span>
              <span class="pill pill-preview js-preview-pill" hidden>Vorschau aktiv</span>
            </div>
          </div>

          <div class="hud-actions-top">
            <button type="button" class="icon-btn js-mute-btn" aria-label="Ton ausschalten" title="Ton">${ICON_SOUND_ON}</button>
            <button type="button" class="icon-btn js-constellation-btn" aria-label="Sternbild-Modus umschalten" title="Sternbild">${ICON_CONSTELLATION}</button>
            <button type="button" class="icon-btn js-gallery-btn" aria-label="Alle 24 Momente öffnen" title="Unsere 24 Momente">${ICON_GALLERY}</button>
          </div>
        </div>

        <div class="hud-bottom">
          <div class="charge-meter js-charge-meter" hidden>
            <div class="charge-fill js-charge-fill"></div>
          </div>
          <div class="hud-hint js-hud-hint"></div>
          <div class="hud-actions-bottom">
            <button type="button" class="btn btn-primary js-today-btn">Heutigen Stern öffnen</button>
            <button type="button" class="btn btn-secondary js-shake-btn">Schütteln</button>
          </div>
        </div>
      </div>

      <div class="toast js-toast" role="status" aria-live="polite"></div>

      <button type="button" class="wake-veil is-hidden js-wake-veil">
        <span class="wake-emblem">${JAR_EMBLEM}</span>
        <span class="wake-title">Für mein Spätzle</span>
        <span class="wake-hint">Tippe, um das Glas aufzuwecken</span>
      </button>

      <div class="overlay overlay-lock js-lock-overlay">
        <div class="lock-card js-lock-card">
          <div class="lock-emblem">${JAR_EMBLEM}</div>
          <p class="lock-kicker">5 Jahre wir</p>
          <h2 class="lock-title">Für mein Spätzle</h2>
          <p class="lock-subtitle">
            In diesem Glas warten 24 kleine Origami-Sterne aus unseren gemeinsamen Jahren auf dich.
          </p>
          <form class="lock-form js-lock-form" novalidate>
            <label class="lock-label" for="jar-password">Nur du kennst das Passwort: Wie nennst du mich?</label>
            <input
              id="jar-password"
              type="text"
              class="lock-input js-lock-input"
              placeholder="Dein Kosename für mich"
              autocomplete="off"
              autocapitalize="none"
              autocorrect="off"
              spellcheck="false"
              enterkeyhint="go"
              aria-describedby="jar-password-error"
            />
            <p class="lock-error js-lock-error" id="jar-password-error" role="alert"></p>
            <button type="submit" class="btn btn-primary">Glas öffnen</button>
          </form>
          <p class="lock-footnote">
            Auf dem iPhone fragt das Glas gleich, ob es Bewegung spüren darf. Sag Ja, dann folgen die Sterne jedem Kippen und Schütteln.
          </p>
        </div>
      </div>

      <div class="overlay is-hidden js-card-overlay" role="dialog" aria-modal="true">
        <div class="modal-shell js-card-container"></div>
      </div>

      <div class="overlay is-hidden js-gallery-overlay" role="dialog" aria-modal="true">
        <div class="modal-shell js-gallery-container"></div>
      </div>
    `;

    this.canvas = this.mustQuery<HTMLCanvasElement>(".scene-canvas");
    this.lockOverlay = this.mustQuery<HTMLElement>(".js-lock-overlay");
    this.lockForm = this.mustQuery<HTMLFormElement>(".js-lock-form");
    this.lockCard = this.mustQuery<HTMLElement>(".js-lock-card");
    this.lockInput = this.mustQuery<HTMLInputElement>(".js-lock-input");
    this.wakeVeil = this.mustQuery<HTMLButtonElement>(".js-wake-veil");
    this.starProgress = this.mustQuery<HTMLElement>(".js-star-progress");
    this.chargeMeter = this.mustQuery<HTMLElement>(".js-charge-meter");
    this.chargeFill = this.mustQuery<HTMLElement>(".js-charge-fill");
    this.lockError = this.mustQuery<HTMLElement>(".js-lock-error");

    this.progressPill = this.mustQuery<HTMLElement>(".js-progress-pill");
    this.previewPill = this.mustQuery<HTMLElement>(".js-preview-pill");
    this.finalePill = this.mustQuery<HTMLElement>(".js-finale-pill");
    this.muteButton = this.mustQuery<HTMLButtonElement>(".js-mute-btn");
    this.constellationButton = this.mustQuery<HTMLButtonElement>(
      ".js-constellation-btn"
    );
    this.galleryButton = this.mustQuery<HTMLButtonElement>(".js-gallery-btn");
    this.todayButton = this.mustQuery<HTMLButtonElement>(".js-today-btn");
    this.shakeButton = this.mustQuery<HTMLButtonElement>(".js-shake-btn");
    this.hintText = this.mustQuery<HTMLElement>(".js-hud-hint");
    this.subtitleButton = this.mustQuery<HTMLElement>(".brand-subtitle");

    this.toastElement = this.mustQuery<HTMLElement>(".js-toast");
    this.cardOverlay = this.mustQuery<HTMLElement>(".js-card-overlay");
    this.cardContainer = this.mustQuery<HTMLElement>(".js-card-container");
    this.galleryOverlay = this.mustQuery<HTMLElement>(".js-gallery-overlay");
    this.galleryContainer = this.mustQuery<HTMLElement>(".js-gallery-container");

    this.bindEvents();
  }

  private mustQuery<T extends Element>(selector: string): T {
    const el = this.root.querySelector<T>(selector);
    if (!el) {
      throw new Error(`Missing required UI element: ${selector}`);
    }
    return el;
  }

  private bindEvents(): void {
    this.lockForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!isJarPasswordValid(this.lockInput.value)) {
        this.lockError.textContent =
          "So nennst du mich nicht. Versuch es noch einmal.";
        // Restart the shake animation even when it is already applied.
        this.lockCard.classList.remove("is-shaking");
        void this.lockCard.offsetWidth;
        this.lockCard.classList.add("is-shaking");
        this.lockInput.select();
        return;
      }
      this.lockError.textContent = "";
      this.lockInput.blur();
      // Not awaited before calling: the handler must start inside this user gesture
      // so iOS shows the motion sensor prompt.
      void this.handlers.onUnlockJar();
    });

    this.wakeVeil.addEventListener("click", () => {
      this.wakeVeil.classList.add("is-hidden");
      this.handlers.onWakeJar();
    });

    this.muteButton.addEventListener("click", () => {
      this.handlers.onToggleMute();
    });

    this.constellationButton.addEventListener("click", () => {
      this.handlers.onToggleConstellation();
    });

    this.galleryButton.addEventListener("click", () => {
      this.openGalleryOverlay();
    });

    this.todayButton.addEventListener("click", () => {
      this.handlers.onOpenTodayStar();
    });

    this.shakeButton.addEventListener("click", () => {
      this.handlers.onManualShake();
    });

    this.subtitleButton.addEventListener("click", () => {
      this.secretTapCount += 1;
      if (this.secretTapResetId !== null) {
        window.clearTimeout(this.secretTapResetId);
      }
      this.secretTapResetId = window.setTimeout(() => {
        this.secretTapCount = 0;
      }, 2200);

      if (this.secretTapCount >= 5) {
        this.secretTapCount = 0;
        this.handlers.onTogglePreviewSecret();
      }
    });

    this.cardOverlay.addEventListener("click", (event) => {
      if (event.target === this.cardOverlay) {
        this.closeCardModal();
      }
    });

    this.galleryOverlay.addEventListener("click", (event) => {
      if (event.target === this.galleryOverlay) {
        this.closeGalleryOverlay();
      }
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        this.closeCardModal();
        this.closeGalleryOverlay();
      }
    });
  }

  public renderState(options: {
    readonly state: PersistedAppState;
    readonly now: Date;
    readonly previewAll: boolean;
    readonly constellationMode: boolean;
  }): void {
    const { state, now, previewAll, constellationMode } = options;
    const openedSet = new Set<number>(state.openedDays);
    const finaleActive = isFinaleUnlocked(openedSet, now, previewAll);
    const todayDay = getActiveTodayDay(now, openedSet, previewAll);

    if (state.unlockedJar && this.lockOverlay.isConnected) {
      // Removing the form (not just hiding it) also clears iOS's "shake to undo typing"
      // prompt, which would otherwise pop up as soon as she shakes the phone.
      this.lockOverlay.remove();
    }

    this.progressPill.textContent = `${openedSet.size} / ${TOTAL_DAYS}`;
    this.renderStarProgress(openedSet, todayDay);
    this.previewPill.hidden = !previewAll;
    this.finalePill.hidden = !finaleActive;

    this.muteButton.innerHTML = state.muted ? ICON_SOUND_OFF : ICON_SOUND_ON;
    this.muteButton.setAttribute(
      "aria-label",
      state.muted ? "Ton einschalten" : "Ton ausschalten"
    );
    this.constellationButton.classList.toggle("is-active", constellationMode);

    if (todayDay === null) {
      if (now.getFullYear() === 2026 && now.getMonth() < 11) {
        this.todayButton.textContent = "Ab dem 1. Dezember bereit";
        this.todayButton.disabled = true;
      } else {
        this.todayButton.textContent = "Alle 24 Sterne im Glas";
        this.todayButton.disabled = false;
      }
    } else if (openedSet.has(todayDay)) {
      this.todayButton.textContent = `Stern ${todayDay} noch einmal ansehen`;
      this.todayButton.disabled = false;
    } else {
      this.todayButton.textContent = `Stern ${todayDay} öffnen`;
      this.todayButton.disabled = false;
    }

    this.hintContext = {
      constellationMode,
      finaleActive,
      unopenedTodayDay:
        todayDay !== null && !openedSet.has(todayDay) ? todayDay : null,
    };
    this.renderHint();

    // Re-render currently open modals if state changed (e.g. voucher stamped).
    if (
      this.currentModalDay !== null &&
      !this.cardOverlay.classList.contains("is-hidden")
    ) {
      const entry = ADVENT_DAYS.find((d) => d.day === this.currentModalDay);
      if (entry) {
        this.renderCardContent(entry, state);
      }
    }

    if (!this.galleryOverlay.classList.contains("is-hidden")) {
      this.renderGalleryContent(state, now, previewAll);
    }
  }

  private renderStarProgress(
    openedSet: ReadonlySet<number>,
    todayDay: number | null
  ): void {
    let dots = "";
    for (let day = 1; day <= TOTAL_DAYS; day++) {
      const stateClass = openedSet.has(day)
        ? " is-on"
        : day === todayDay
          ? " is-today"
          : "";
      dots += `<span class="star-dot${stateClass}"></span>`;
    }
    this.starProgress.innerHTML = dots;
  }

  private renderHint(): void {
    const { constellationMode, finaleActive, unopenedTodayDay } =
      this.hintContext;

    if (constellationMode) {
      this.hintText.textContent = "Sternbild: Alle Sterne formen unser Herz";
    } else if (unopenedTodayDay !== null) {
      this.hintText.textContent = this.sensorsLive
        ? `Schüttle dein iPhone, bis Stern ${unopenedTodayDay} erwacht – oder tippe ihn an`
        : `Tippe Stern ${unopenedTodayDay} an – oder schüttle das Glas, bis er erwacht`;
    } else if (finaleActive) {
      this.hintText.textContent =
        "Frohe Weihnachten! Schüttle das Glas für die goldene Schneekugel";
    } else {
      this.hintText.textContent = this.sensorsLive
        ? "Kippe, drehe und schüttle dein iPhone – die Sterne folgen dir"
        : "Ziehe durch das Glas, um die Sterne zu verwirbeln";
    }
  }

  /**
   * Switches hints and controls between sensor mode (iPhone) and pointer mode (Mac).
   */
  public setSensorsLive(live: boolean): void {
    this.sensorsLive = live;
    this.shakeButton.hidden = live;
    this.renderHint();
  }

  /** Shows how far today's star has been shaken awake (0..1). */
  public setTodayCharge(progress: number): void {
    const clamped = Math.max(0, Math.min(1, progress));
    this.chargeMeter.hidden = clamped <= 0.01;
    this.chargeFill.style.transform = `scaleX(${clamped.toFixed(3)})`;
  }

  /** Shows the "tap to wake" veil on return visits (needed to re-enable sensors and audio). */
  public showWakeVeil(): void {
    this.wakeVeil.classList.remove("is-hidden");
  }

  /** True while the lock screen, wake veil, a card, or the gallery covers the jar. */
  public isOverlayOpen(): boolean {
    return (
      this.lockOverlay.isConnected ||
      !this.wakeVeil.classList.contains("is-hidden") ||
      !this.cardOverlay.classList.contains("is-hidden") ||
      !this.galleryOverlay.classList.contains("is-hidden")
    );
  }

  public showToast(message: string): void {
    this.toastElement.textContent = message;
    this.toastElement.classList.add("is-visible");
    if (this.toastTimerId !== null) {
      window.clearTimeout(this.toastTimerId);
    }
    this.toastTimerId = window.setTimeout(() => {
      this.toastElement.classList.remove("is-visible");
    }, 2800);
  }

  public openCardModal(day: AdventDay, state: PersistedAppState): void {
    this.currentModalDay = day.day;
    this.renderCardContent(day, state);
    this.cardOverlay.classList.remove("is-hidden");
  }

  public closeCardModal(): void {
    this.stopActiveMedia();
    this.currentModalDay = null;
    this.cardOverlay.classList.add("is-hidden");
  }

  private stopActiveMedia(): void {
    this.cardContainer
      .querySelectorAll<HTMLMediaElement>("audio, video")
      .forEach((mediaEl) => {
        mediaEl.pause();
      });
  }

  private renderCardContent(day: AdventDay, state: PersistedAppState): void {
    this.stopActiveMedia();

    const typeClass =
      day.type === "letter"
        ? "is-letter"
        : day.type === "voucher"
          ? "is-voucher"
          : day.type === "compliment"
            ? "is-compliment"
            : day.type === "media"
              ? "is-media"
              : "is-polaroid";

    const subtitleHtml = day.subtitle
      ? `<p class="card-subtitle">${escapeHtml(day.subtitle)}</p>`
      : "";

    let bodySpecificHtml = "";
    if (day.type === "polaroid") {
      const caption = day.photoCaption ?? day.title;
      const fallbackSvg = createPolaroidFallbackSvg(day.day, day.title);
      const mediaHtml = day.photoUrl
        ? `<img src="${escapeHtml(day.photoUrl)}" alt="${escapeHtml(day.title)}" class="js-polaroid-img" />`
        : fallbackSvg;

      bodySpecificHtml = `
        <div class="card-polaroid-frame">
          <div class="card-polaroid-media js-polaroid-media">${mediaHtml}</div>
          <p class="card-polaroid-caption">${escapeHtml(caption)}</p>
        </div>
        <p class="card-message">${escapeHtml(day.message)}</p>
      `;
    } else if (day.type === "letter") {
      bodySpecificHtml = `
        <p class="card-message">${escapeHtml(day.message)}</p>
        <div class="wax-seal">♥ 5 Jahre Spätzle &amp; Du</div>
      `;
    } else if (day.type === "voucher") {
      const redeemedDate = state.redeemedVouchers[day.day];
      const codeHtml = day.voucherCode
        ? `<div class="voucher-code-box"><span>Gutschein-Code</span><span class="voucher-code-value">${escapeHtml(day.voucherCode)}</span></div>`
        : "";
      const actionHtml = redeemedDate
        ? `<div class="voucher-stamp">EINGELÖST AM ${escapeHtml(redeemedDate)} ♥</div>`
        : `<button type="button" class="btn btn-primary js-redeem-voucher-btn">Gutschein einlösen 💌</button>`;

      bodySpecificHtml = `
        <p class="card-message">${escapeHtml(day.message)}</p>
        ${codeHtml}
        <div class="voucher-actions">${actionHtml}</div>
      `;
    } else if (day.type === "media") {
      const videoBlock = day.videoUrl
        ? `
          <div class="card-video-box js-video-box">
            <video
              class="card-video-player js-media-video"
              src="${escapeHtml(day.videoUrl)}"
              ${day.videoPosterUrl ? `poster="${escapeHtml(day.videoPosterUrl)}"` : ""}
              controls
              playsinline
              preload="metadata"
            ></video>
          </div>
        `
        : "";

      const audioBlock = day.audioUrl
        ? `
          <div class="card-audio-box js-audio-box">
            ${createAudioVisualizerMarkup()}
            <audio
              class="card-audio-player js-media-audio"
              src="${escapeHtml(day.audioUrl)}"
              controls
              preload="metadata"
            ></audio>
          </div>
        `
        : "";

      const mediaItemsHtml =
        videoBlock || audioBlock
          ? `${videoBlock}${audioBlock}`
          : createMediaFallbackMarkup(
              day.subtitle?.toLowerCase().includes("video") ? "video" : "audio"
            );

      const captionHtml = day.mediaCaption
        ? `<p class="card-media-caption">${escapeHtml(day.mediaCaption)}</p>`
        : "";

      bodySpecificHtml = `
        <div class="card-media-stage">
          ${mediaItemsHtml}
          ${captionHtml}
        </div>
        <p class="card-message">${escapeHtml(day.message)}</p>
      `;
    } else {
      const highlight = day.complimentHighlight ?? day.title;
      bodySpecificHtml = `
        <div class="compliment-quote">„${escapeHtml(highlight)}“</div>
        <p class="card-message">${escapeHtml(day.message)}</p>
      `;
    }

    this.cardContainer.innerHTML = `
      <div class="card-paper ${typeClass}">
        <button type="button" class="modal-close js-close-card-btn" aria-label="Schließen">✕</button>
        <div class="card-meta-row">
          <span class="card-day-pill">Tag ${day.day} • Dezember</span>
          <span class="card-year-pill">${escapeHtml(day.yearBadge)}</span>
        </div>
        <h2 class="card-title">${escapeHtml(day.title)}</h2>
        ${subtitleHtml}
        ${bodySpecificHtml}
      </div>
    `;

    const closeBtn = this.cardContainer.querySelector(".js-close-card-btn");
    closeBtn?.addEventListener("click", () => this.closeCardModal());

    const redeemBtn = this.cardContainer.querySelector(
      ".js-redeem-voucher-btn"
    );
    redeemBtn?.addEventListener("click", () => {
      this.handlers.onRedeemVoucher(day.day);
    });

    const polaroidImg = this.cardContainer.querySelector<HTMLImageElement>(
      ".js-polaroid-img"
    );
    if (polaroidImg) {
      polaroidImg.addEventListener("error", () => {
        const mediaBox =
          this.cardContainer.querySelector(".js-polaroid-media");
        if (mediaBox) {
          mediaBox.innerHTML = createPolaroidFallbackSvg(day.day, day.title);
        }
      });
    }

    const videoPlayer =
      this.cardContainer.querySelector<HTMLVideoElement>(".js-media-video");
    if (videoPlayer) {
      videoPlayer.addEventListener("error", () => {
        const videoBox = this.cardContainer.querySelector(".js-video-box");
        if (videoBox) {
          videoBox.innerHTML = createMediaFallbackMarkup("video", day.videoUrl);
        }
      });
    }

    const audioPlayer =
      this.cardContainer.querySelector<HTMLAudioElement>(".js-media-audio");
    if (audioPlayer) {
      audioPlayer.addEventListener("error", () => {
        const audioBox = this.cardContainer.querySelector(".js-audio-box");
        if (audioBox) {
          audioBox.innerHTML = createMediaFallbackMarkup("audio", day.audioUrl);
        }
      });
    }
  }

  private lastGalleryRenderArgs: {
    state: PersistedAppState;
    now: Date;
    previewAll: boolean;
  } | null = null;

  public setGalleryContext(
    state: PersistedAppState,
    now: Date,
    previewAll: boolean
  ): void {
    this.lastGalleryRenderArgs = { state, now, previewAll };
  }

  private openGalleryOverlay(): void {
    if (this.lastGalleryRenderArgs) {
      this.renderGalleryContent(
        this.lastGalleryRenderArgs.state,
        this.lastGalleryRenderArgs.now,
        this.lastGalleryRenderArgs.previewAll
      );
    }
    this.galleryOverlay.classList.remove("is-hidden");
  }

  private closeGalleryOverlay(): void {
    this.galleryOverlay.classList.add("is-hidden");
  }

  private renderGalleryContent(
    state: PersistedAppState,
    now: Date,
    previewAll: boolean
  ): void {
    const openedSet = new Set<number>(state.openedDays);
    const tilesHtml = ADVENT_DAYS.map((entry) => {
      const visualState: StarVisualState = getStarVisualState(
        entry.day,
        openedSet,
        now,
        previewAll
      );
      const isLocked = visualState === "locked";
      const stateClass =
        visualState === "opened"
          ? "is-opened"
          : visualState === "available_today"
            ? "is-today"
            : isLocked
              ? "is-locked"
              : "";
      const redeemedMark = state.redeemedVouchers[entry.day] ? " ♥" : "";
      const icon = isLocked ? "🔒" : `${getCardTypeIcon(entry.type)}${redeemedMark}`;

      return `
        <button type="button" class="gallery-tile ${stateClass}" data-day="${entry.day}" aria-label="Tag ${entry.day}">
          <span class="gallery-day">${entry.day}</span>
          <span class="gallery-icon">${icon}</span>
        </button>
      `;
    }).join("");

    this.galleryContainer.innerHTML = `
      <div class="gallery-panel">
        <button type="button" class="modal-close js-close-gallery-btn" aria-label="Galerie schließen">✕</button>
        <h2 class="gallery-title">Unsere 24 Momente</h2>
        <p class="gallery-subtitle">${openedSet.size} von 24 Sternen bereits geöffnet</p>
        <div class="gallery-grid">${tilesHtml}</div>
      </div>
    `;

    this.galleryContainer
      .querySelector(".js-close-gallery-btn")
      ?.addEventListener("click", () => this.closeGalleryOverlay());

    this.galleryContainer
      .querySelectorAll<HTMLButtonElement>(".gallery-tile")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const dayNum = Number(btn.dataset.day);
          if (Number.isInteger(dayNum)) {
            this.closeGalleryOverlay();
            this.handlers.onSelectStar(dayNum);
          }
        });
      });
  }
}
