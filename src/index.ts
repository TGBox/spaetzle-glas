import "./styles/main.css";
import { SoundscapeController } from "./audio/soundscape";
import {
  getActiveTodayDay,
  getAdventDayByNumber,
  getStarVisualState,
  isDayUnlocked,
  isFinaleUnlocked,
} from "./domain/adventRules";
import {
  loadAppState,
  markDayOpened,
  redeemVoucherDay,
  setJarUnlockedState,
  setMutedState,
} from "./domain/storage";
import { MotionController } from "./input/motionController";
import { StarPhysicsWorld } from "./physics/starPhysics";
import { JarScene } from "./scene/jarScene";
import type { PersistedAppState, StarVisualState } from "./types/advent";
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

function bootstrap(): void {
  const root = document.getElementById("app");
  if (!root) {
    return;
  }

  let appState: PersistedAppState = loadAppState();
  let previewAll = readInitialPreviewFlag();
  let constellationMode = false;

  const physics = new StarPhysicsWorld();
  const soundscape = new SoundscapeController(appState.muted);

  let jarScene: JarScene | null = null;
  let motionController: MotionController | null = null;

  const syncAllViews = (): void => {
    const now = new Date();
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

  const handleSelectStar = (day: number): void => {
    void soundscape.unlock();
    const now = new Date();

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
    soundscape.playStarOpen(day);
    syncAllViews();
    ui.openCardModal(entry, appState);

    if (!wasAlreadyOpened && day === 24) {
      ui.showToast("Alle 24 Sterne erwacht — Schneekugel-Finale aktiv ❄️✨");
    }
  };

  const ui = new AppUi(root, {
    onUnlockJar: async () => {
      await soundscape.unlock();
      await motionController?.requestPermissionsFromUserGesture();
      appState = setJarUnlockedState(appState, true);
      soundscape.playJarUnlock();
      motionController?.triggerManualShake(0.9);
      jarScene?.registerShakeBurst();
      syncAllViews();
    },
    onSelectStar: handleSelectStar,
    onOpenTodayStar: () => {
      const now = new Date();
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
      void motionController?.requestPermissionsFromUserGesture();
      motionController?.triggerManualShake(1.05);
      jarScene?.registerShakeBurst();
    },
    onToggleConstellation: () => {
      void soundscape.unlock();
      constellationMode = !constellationMode;
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
      appState = redeemVoucherDay(appState, day, new Date());
      soundscape.playVoucherRedeem();
      syncAllViews();
      ui.showToast("Gutschein abgestempelt ♥");
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

  motionController = new MotionController({
    onShake: (impulse) => {
      physics.applyShakeImpulse(impulse);
      jarScene?.registerShakeBurst();
    },
    onGravityChange: (gravity) => {
      jarScene?.setGravity(gravity);
    },
  });

  if (appState.unlockedJar) {
    motionController.startListening();
  }

  jarScene = new JarScene({
    canvas: ui.canvas,
    physics,
    onStarTap: handleSelectStar,
    onCollision: (intensity, day) => {
      soundscape.playCollisionChime(intensity, day);
    },
    onSwirlShake: (impulse) => {
      physics.applyShakeImpulse(impulse, 0.9);
      jarScene?.registerShakeBurst();
    },
  });

  syncAllViews();
  jarScene.start();
  registerServiceWorker();
}

bootstrap();
