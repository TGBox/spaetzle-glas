import "./styles/main.css";
import { SoundscapeController } from "./audio/soundscape";
import {
  getActiveTodayDay,
  getAdventDayByNumber,
  getMissedDayNote,
  getStarVisualState,
  isDayMissed,
  isDayUnlocked,
  isFinaleUnlocked,
} from "./domain/adventRules";
import {
  loadAppState,
  markDayOpened,
  addBeeFoundWord,
  markQuizSolved,
  markVoucherScratched,
  redeemVoucherDay,
  setJarUnlockedState,
  setMutedState,
  resetPreviewState,
  usePreviewStorage,
} from "./domain/storage";
import { Haptics } from "./feedback/haptics";
import { MotionController } from "./input/motionController";
import { StarPhysicsWorld } from "./physics/starPhysics";
import { JarScene } from "./scene/jarScene";
import type { PersistedAppState, StarVisualState } from "./types/advent";
import {
  formatPreviewDay,
  PREVIEW_MAX_DAY,
  PREVIEW_MIN_DAY,
  PreviewBar,
  readPreviewDay,
  simulatedDate,
} from "./preview/previewTools";
import { AppUi } from "./ui/appUi";

function registerServiceWorker(): void {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // Ignore registration errors in unsupported or insecure dev contexts.
      });
    });
  }
}

function readInitialPreviewFlag(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get("preview") === "true" || params.get("preview") === "1";
}

/** Charge added to today's star per detected shake: base plus a share of the shake strength. */
const WAKE_CHARGE_BASE = 0.07;
const WAKE_CHARGE_PER_STRENGTH = 0.11;
/** Charge lost per tick when she stops shaking (a full charge fades in about 8 seconds). */
const WAKE_CHARGE_DECAY_PER_TICK = 0.0125;
const WAKE_CHARGE_TICK_MS = 100;

/** Keeps the display on while she plays with the jar (no touches happen while shaking). */
async function requestScreenWakeLock(): Promise<void> {
  try {
    await navigator.wakeLock?.request("screen");
  } catch {
    // Unsupported or denied (e.g. low power mode); the jar works without it.
  }
}

function bootstrap(): void {
  const root = document.getElementById("app");
  if (!root) {
    return;
  }

  const previewMode = readInitialPreviewFlag();
  if (previewMode) {
    usePreviewStorage();
  }
  let appState: PersistedAppState = loadAppState();
  /** Simulated calendar day while previewing (null = real date). */
  let previewDay = previewMode ? readPreviewDay(window.location.search) : null;
  let previewAll = previewMode && previewDay === null;
  const getNow = (): Date =>
    previewDay === null ? new Date() : simulatedDate(previewDay);
  let constellationMode = false;
  let todayCharge = 0;

  const physics = new StarPhysicsWorld();
  const soundscape = new SoundscapeController(appState.muted);
  const haptics = new Haptics();

  let jarScene: JarScene | null = null;
  let motionController: MotionController | null = null;

  const syncAllViews = (): void => {
    const now = getNow();
    const openedSet = new Set<number>(appState.openedDays);
    const stateByDay = new Map<number, StarVisualState>();
    for (let day = 1; day <= 24; day++) {
      stateByDay.set(day, getStarVisualState(day, openedSet, now, previewAll));
    }

    const todayDay = getActiveTodayDay(now, openedSet, previewAll);
    const finaleMode = isFinaleUnlocked(openedSet, now, previewAll);

    ui.setGalleryContext(appState, now, previewAll);
    ui.renderState({
      state: appState,
      now,
      previewAll,
      constellationMode,
    });

    jarScene?.updateVisualSnapshot({
      stateByDay,
      todayDay,
      constellationMode,
      finaleMode,
    });
  };

  const setTodayCharge = (value: number): void => {
    todayCharge = Math.max(0, Math.min(1, value));
    jarScene?.setTodayCharge(todayCharge);
    ui.setTodayCharge(todayCharge);
  };

  const getUnopenedTodayDay = (): number | null => {
    const openedSet = new Set<number>(appState.openedDays);
    const todayDay = getActiveTodayDay(getNow(), openedSet, previewAll);
    return todayDay !== null && !openedSet.has(todayDay) ? todayDay : null;
  };

  const handleSelectStar = (day: number): void => {
    void soundscape.unlock();
    haptics.tick();
    const now = getNow();

    if (!isDayUnlocked(day, now, previewAll)) {
      soundscape.playLockedTap();
      jarScene?.triggerLockedStarWiggle(day);
      ui.showToast(`Dieses Türchen erwacht erst am ${day}. Dezember ✨`);
      return;
    }

    const entry = getAdventDayByNumber(day);
    if (!entry) {
      return;
    }

    const wasAlreadyOpened = appState.openedDays.includes(day);
    appState = markDayOpened(appState, day);
    setTodayCharge(0);
    soundscape.playStarOpen(day);
    syncAllViews();
    // A star opened after its day greets her with a wink (not while previewing).
    const lateNote =
      !wasAlreadyOpened && !previewAll ? getMissedDayNote(day, now) : null;
    ui.openCardModal(entry, appState, lateNote);

    if (!wasAlreadyOpened && day === 24) {
      ui.showToast("Alle 24 Sterne erwacht — Schneekugel-Finale aktiv ❄️✨");
    }
  };

  /** Tells her when stars from earlier days are still waiting (they wink in the jar). */
  const announceMissedStars = (): void => {
    if (previewAll) {
      return;
    }
    const now = getNow();
    let missedCount = 0;
    for (let day = 1; day <= 24; day++) {
      if (isDayMissed(day, now) && !appState.openedDays.includes(day)) {
        missedCount++;
      }
    }
    if (missedCount === 1) {
      ui.showToast("Ein Stern zwinkert dir zu: Er wartet noch auf dich 😉");
    } else if (missedCount > 1) {
      ui.showToast(
        `${missedCount} Sterne zwinkern dir zu: Sie warten noch auf dich 😉`
      );
    }
  };

  /**
   * Reacts to a shake from the sensors, the shake button, or the unlock flourish:
   * tumbles the stars and gradually wakes today's unopened star until it opens.
   */
  const handleShake = (strength: number): void => {
    if (motionController?.hasLiveSensors()) {
      // Real acceleration already moves the stars; only add tumbling on top.
      physics.applyShakeImpulse({ x: 0, y: 0, z: 0 }, 0.9 + strength * 1.6);
    } else {
      const angle = Math.random() * Math.PI * 2;
      physics.applyShakeImpulse({
        x: Math.cos(angle) * 2.2 * strength,
        y: 3.4 * strength,
        z: Math.sin(angle) * 2.2 * strength,
      });
    }
    jarScene?.registerShakeBurst(0.35 + strength * 0.5);

    if (constellationMode || ui.isOverlayOpen()) {
      return;
    }
    const unopenedToday = getUnopenedTodayDay();
    if (unopenedToday === null) {
      return;
    }

    const nextCharge =
      todayCharge + WAKE_CHARGE_BASE + strength * WAKE_CHARGE_PER_STRENGTH;
    if (nextCharge >= 1) {
      handleSelectStar(unopenedToday);
      return;
    }
    setTodayCharge(nextCharge);
    soundscape.playChargeStep(nextCharge);
  };

  const ui = new AppUi(root, {
    onUnlockJar: async () => {
      // Both requests start synchronously inside the tap so iOS accepts them.
      const motionRequest =
        motionController?.requestPermissionsFromUserGesture() ??
        Promise.resolve(false);
      const audioRequest = soundscape.unlock();
      haptics.tick();
      const [motionGranted] = await Promise.all([motionRequest, audioRequest]);

      appState = setJarUnlockedState(appState, true);
      soundscape.playJarUnlock();
      syncAllViews();
      handleShake(0.9);
      void requestScreenWakeLock();

      if (!motionGranted) {
        ui.showToast(
          "Ohne Bewegungssensoren: Ziehe durch das Glas oder tippe auf „Schütteln“"
        );
      } else {
        announceMissedStars();
      }
    },
    onWakeJar: () => {
      void motionController?.requestPermissionsFromUserGesture();
      void soundscape.unlock().then(() => soundscape.playJarUnlock());
      haptics.tick();
      handleShake(0.6);
      void requestScreenWakeLock();
      announceMissedStars();
    },
    onSelectStar: handleSelectStar,
    onOpenTodayStar: () => {
      const now = getNow();
      const openedSet = new Set<number>(appState.openedDays);
      const todayDay = getActiveTodayDay(now, openedSet, previewAll);
      if (todayDay !== null) {
        handleSelectStar(todayDay);
      } else {
        ui.showToast("Ab dem 1. Dezember öffnet sich der erste Stern ✨");
      }
    },
    onManualShake: () => {
      void soundscape.unlock();
      haptics.tick();
      motionController?.triggerManualShake(1);
    },
    onToggleConstellation: () => {
      void soundscape.unlock();
      constellationMode = !constellationMode;
      setTodayCharge(0);
      syncAllViews();
    },
    onToggleMute: () => {
      const nextMuted = !appState.muted;
      appState = setMutedState(appState, nextMuted);
      soundscape.setMuted(nextMuted);
      if (!nextMuted) {
        void soundscape.unlock();
      }
      syncAllViews();
    },
    onRedeemVoucher: (day: number) => {
      void soundscape.unlock();
      appState = redeemVoucherDay(appState, day, getNow());
      soundscape.playVoucherRedeem();
      haptics.tick();
      syncAllViews();
      ui.showToast("Gutschein abgestempelt ♥");
    },
    onVoucherScratched: (day: number) => {
      appState = markVoucherScratched(appState, day);
      soundscape.playStarOpen(day);
      haptics.tick();
      syncAllViews();
    },
    onQuizAnswer: (day: number, correct: boolean) => {
      void soundscape.unlock();
      haptics.tick();
      if (correct) {
        appState = markQuizSolved(appState, day);
        soundscape.playStarOpen(day);
        syncAllViews();
      } else {
        soundscape.playLockedTap();
      }
    },
    onBeeWordFound: (
      day: number,
      word: string,
      isPangram: boolean,
      solvesPuzzle: boolean
    ) => {
      void soundscape.unlock();
      haptics.tick();
      appState = addBeeFoundWord(appState, day, word);
      if (isPangram || solvesPuzzle) {
        soundscape.playStarOpen(day);
      } else {
        soundscape.playChargeStep(Math.min(1, Array.from(word).length / 9));
      }
      syncAllViews();
    },
    onBeeMiss: () => {
      void soundscape.unlock();
      haptics.tick();
      soundscape.playLockedTap();
    },
    onTogglePreviewSecret: () => {
      previewAll = !previewAll;
      syncAllViews();
      ui.showToast(
        previewAll
          ? "Vorschau-Modus aktiviert (alle 24 Tage testbar)"
          : "Vorschau-Modus deaktiviert"
      );
    },
  });

  if (previewMode) {
    /** Opens any day from a card's arrows; a locked day is shown without counting as opened. */
    const openPreviewDay = (day: number): void => {
      if (day < 1 || day > 24) {
        return;
      }
      if (isDayUnlocked(day, getNow(), previewAll)) {
        handleSelectStar(day);
        return;
      }
      const entry = getAdventDayByNumber(day);
      if (entry) {
        ui.openCardModal(entry, appState, null);
        ui.showToast(`Vorschau: Tag ${day} ist am ${formatPreviewDay(previewDay)} noch gesperrt`);
      }
    };

    const applyPreviewDay = (day: number | null): void => {
      previewDay =
        day === null ? null : Math.max(PREVIEW_MIN_DAY, Math.min(PREVIEW_MAX_DAY, day));
      if (previewDay !== null) {
        previewAll = false;
      }
      const url = new URL(window.location.href);
      if (previewDay === null) {
        url.searchParams.delete("day");
      } else {
        url.searchParams.set("day", String(previewDay));
      }
      window.history.replaceState(null, "", url);
      setTodayCharge(0);
      ui.closeCardModal();
      syncAllViews();
      previewBar.update(previewDay, previewAll);
      ui.showToast(`Vorschau: ${formatPreviewDay(previewDay)}`);
      window.setTimeout(announceMissedStars, 1600);
    };

    const previewBar = new PreviewBar({
      onSetDay: applyPreviewDay,
      onShiftDay: (delta) => applyPreviewDay((previewDay ?? PREVIEW_MIN_DAY) + delta),
      onToggleAll: () => {
        previewAll = !previewAll;
        syncAllViews();
        previewBar.update(previewDay, previewAll);
      },
      onReset: () => {
        appState = resetPreviewState();
        setTodayCharge(0);
        ui.closeCardModal();
        syncAllViews();
        ui.showToast("Vorschau zurückgesetzt: kein Stern geöffnet");
      },
    });
    previewBar.update(previewDay, previewAll);
    ui.setCardDayNavigation(openPreviewDay);
  }

  motionController = new MotionController({
    onGravityDirection: (direction) => {
      jarScene?.setGravityDirection(direction);
    },
    onLinearAcceleration: (acceleration) => {
      jarScene?.setLinearAcceleration(acceleration);
    },
    onTwist: (radiansPerSecond) => {
      jarScene?.setTwistRate(radiansPerSecond);
    },
    onShake: handleShake,
    onSensorsLive: () => {
      ui.setSensorsLive(true);
    },
  });

  jarScene = new JarScene({
    canvas: ui.canvas,
    physics,
    onStarTap: handleSelectStar,
    onCollision: (intensity, day) => {
      // Stay quiet while a card is open so chimes never talk over her music or videos.
      if (!ui.isOverlayOpen()) {
        soundscape.playCollisionChime(intensity, day);
      }
    },
    onGlassKnock: () => {
      void soundscape.unlock();
      soundscape.playGlassKnock();
      haptics.tick();
    },
  });

  // Today's star slowly falls back asleep when she stops shaking.
  window.setInterval(() => {
    if (todayCharge > 0) {
      setTodayCharge(todayCharge - WAKE_CHARGE_DECAY_PER_TICK);
    }
  }, WAKE_CHARGE_TICK_MS);

  // iOS releases the wake lock and suspends audio whenever the app goes to the background.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && appState.unlockedJar) {
      void requestScreenWakeLock();
    }
  });

  if (appState.unlockedJar) {
    // Sensors and audio need a fresh tap after every app launch on iOS.
    ui.showWakeVeil();
  }

  syncAllViews();
  jarScene.start();
  registerServiceWorker();
}

bootstrap();
