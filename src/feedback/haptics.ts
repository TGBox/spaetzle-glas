interface VibrationCapableNavigator {
  vibrate?: (pattern: number | number[]) => boolean;
}

/**
 * Light tactile feedback for taps.
 *
 * Android and desktop browsers use the Vibration API. iOS Safari has no Vibration API,
 * but toggling a native `<input type="checkbox" switch>` (iOS 17.4+) produces the
 * system's haptic tick, so a hidden switch is toggled instead. Where neither is
 * available this silently does nothing. Call it from within a user gesture.
 */
export class Haptics {
  private readonly switchLabel: HTMLLabelElement | null = null;
  private readonly canVibrate: boolean;

  constructor() {
    if (typeof document === "undefined" || typeof navigator === "undefined") {
      this.canVibrate = false;
      return;
    }

    this.canVibrate =
      typeof (navigator as VibrationCapableNavigator).vibrate === "function";
    if (this.canVibrate) {
      return;
    }

    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.display = "none";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;

    label.appendChild(input);
    document.body.appendChild(label);
    this.switchLabel = label;
  }

  /** A single light tick. */
  public tick(): void {
    try {
      if (this.canVibrate) {
        (navigator as VibrationCapableNavigator).vibrate?.(10);
      } else {
        this.switchLabel?.click();
      }
    } catch {
      // Haptics are a nice-to-have; never let them break an interaction.
    }
  }
}
