import { ADVENT_DAYS } from "../data/adventDays";
import {
  getActiveTodayDay,
  getStarVisualState,
  isAnniversaryCodeValid,
  isFinaleUnlocked,
} from "../domain/adventRules";
import type { AdventDay, CardType, PersistedAppState, StarVisualState } from "../types/advent";

export interface UiHandlers {
  readonly onUnlockJar: () => Promise<void>;
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
  private readonly lockInput: HTMLInputElement;
  private readonly lockError: HTMLElement;

  private readonly progressPill: HTMLElement;
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
            <div class="status-pills">
              <span class="pill js-progress-pill">0 / 24 Sterne leuchten</span>
              <span class="pill pill-finale js-finale-pill" hidden>❄️ Heiligabend-Schneekugel</span>
              <span class="pill pill-preview js-preview-pill" hidden>Vorschau aktiv</span>
            </div>
          </div>

          <div class="hud-actions-top">
            <button type="button" class="icon-btn js-mute-btn" aria-label="Ton ein- oder ausschalten" title="Ton">🔊</button>
            <button type="button" class="icon-btn js-constellation-btn" aria-label="Sternbild-Modus umschalten" title="Sternbild">✨</button>
            <button type="button" class="icon-btn js-gallery-btn" aria-label="Alle 24 Momente öffnen" title="Galerie">📖</button>
          </div>
        </div>

        <div class="hud-bottom">
          <div class="hud-hint js-hud-hint">Tippe einen leuchtenden Stern an oder schüttle dein iPhone</div>
          <div class="hud-actions-bottom">
            <button type="button" class="btn btn-primary js-today-btn">Heutigen Stern öffnen</button>
            <button type="button" class="btn btn-secondary js-shake-btn">Schütteln 💫</button>
          </div>
        </div>
      </div>

      <div class="toast js-toast" role="status" aria-live="polite"></div>

      <div class="overlay js-lock-overlay">
        <div class="lock-card">
          <div class="lock-emblem">✨🫙✨</div>
          <h2 class="lock-title">Für mein Spätzle</h2>
          <p class="lock-subtitle">
            Alles Liebe zum <strong>5-jährigen Jubiläum</strong>! In diesem Glas warten 24 kleine Origami-Sterne aus unseren gemeinsamen Jahren auf dich.
          </p>
          <form class="lock-form js-lock-form">
            <input
              type="text"
              inputmode="numeric"
              autocomplete="off"
              class="lock-input js-lock-input"
              placeholder="Unser Jubiläumsdatum (z. B. 01.12.2021)"
              aria-label="Jubiläumsdatum eingeben"
            />
            <p class="lock-error js-lock-error"></p>
            <button type="submit" class="btn btn-primary">Glas entriegeln ✨</button>
          </form>
          <p class="lock-footnote">
            Tipp: Mit dem Öffnen werden Klanglandschaft &amp; Schüttel-Sensor aktiviert.
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
    this.lockInput = this.mustQuery<HTMLInputElement>(".js-lock-input");
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
    this.lockForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!isAnniversaryCodeValid(this.lockInput.value)) {
        this.lockError.textContent =
          "Das passt noch nicht ganz — denk an den 01.12.2021 ✨";
        return;
      }
      this.lockError.textContent = "";
      await this.handlers.onUnlockJar();
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

    if (state.unlockedJar) {
      this.lockOverlay.classList.add("is-hidden");
    } else {
      this.lockOverlay.classList.remove("is-hidden");
    }

    this.progressPill.textContent = `${openedSet.size} / 24 Sterne leuchten`;
    this.previewPill.hidden = !previewAll;
    this.finalePill.hidden = !finaleActive;

    this.muteButton.textContent = state.muted ? "🔇" : "🔊";
    this.constellationButton.classList.toggle("is-active", constellationMode);

    if (todayDay === null) {
      if (now.getFullYear() === 2026 && now.getMonth() < 11) {
        this.todayButton.textContent = "Ab 1. Dezember bereit ✨";
        this.todayButton.disabled = true;
      } else {
        this.todayButton.textContent = "Alle 24 Sterne im Glas ✨";
        this.todayButton.disabled = false;
      }
    } else if (openedSet.has(todayDay)) {
      this.todayButton.textContent = `Stern ${todayDay} noch einmal ansehen`;
      this.todayButton.disabled = false;
    } else {
      this.todayButton.textContent = `Heutigen Stern öffnen (Tag ${todayDay})`;
      this.todayButton.disabled = false;
    }

    this.hintText.textContent = constellationMode
      ? "Sternbild-Modus: Alle Sterne formen unser Herz ✨"
      : finaleActive
        ? "Frohe Weihnachten! Schüttle für die goldene Schneekugel ❄️"
        : "Tippe einen Stern an, ziehe zum Drehen oder schüttle das Glas";

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
