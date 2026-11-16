export interface ScratchOptions {
  /** Text printed on the foil. */
  readonly label: string;
  /** Called once when enough of the foil has been rubbed away. */
  readonly onRevealed: () => void;
}

/** Share of the foil that must be gone before the rest clears itself. */
export const SCRATCH_REVEAL_RATIO = 0.5;
const BRUSH_RADIUS_CSS_PX = 24;
const CLEAR_ANIMATION_MS = 380;
const SAMPLE_STEP = 6;

/**
 * Computes the share of fully transparent pixels in RGBA image data,
 * sampling every `step`-th pixel in both directions.
 */
export function computeClearedRatio(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  step = SAMPLE_STEP
): number {
  let sampled = 0;
  let cleared = 0;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      sampled++;
      if (rgba[(y * width + x) * 4 + 3] === 0) {
        cleared++;
      }
    }
  }
  return sampled === 0 ? 0 : cleared / sampled;
}

function paintFoil(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: number,
  label: string
): void {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#f6d58a");
  gradient.addColorStop(0.35, "#d9a24a");
  gradient.addColorStop(0.6, "#fbe3a4");
  gradient.addColorStop(1, "#c98a3a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Deterministic sparkle specks so the foil reads as metallic, not flat.
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  for (let i = 0; i < 70; i++) {
    const x = ((i * 137.5) % 100) / 100;
    const y = ((i * 61.8 + 17) % 100) / 100;
    const size = (1 + (i % 3)) * scale;
    ctx.fillRect(x * width, y * height, size, size);
  }

  ctx.fillStyle = "#5a3610";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.round(19 * scale)}px Georgia, "Times New Roman", serif`;
  ctx.fillText(label, width / 2, height / 2 - 10 * scale);
  ctx.font = `600 ${Math.round(12.5 * scale)}px -apple-system, "Segoe UI", sans-serif`;
  ctx.fillText("mit dem Finger rubbeln", width / 2, height / 2 + 16 * scale);
}

/**
 * Turns a canvas that overlays some content into a scratch-off foil.
 * The canvas must already be laid out (visible) so its size can be measured.
 */
export function attachScratchSurface(
  canvas: HTMLCanvasElement,
  options: ScratchOptions
): void {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * scale));
  const height = Math.max(1, Math.round(rect.height * scale));
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    // Without a 2D context there is nothing to scratch: show the content right away.
    canvas.remove();
    options.onRevealed();
    return;
  }

  paintFoil(ctx, width, height, scale, options.label);
  ctx.globalCompositeOperation = "destination-out";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = BRUSH_RADIUS_CSS_PX * 2 * scale;

  let activePointerId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let revealed = false;

  const toCanvasPoint = (event: PointerEvent): { x: number; y: number } => {
    const box = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / Math.max(1, box.width)) * width,
      y: ((event.clientY - box.top) / Math.max(1, box.height)) * height,
    };
  };

  const scratchTo = (x: number, y: number): void => {
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastX = x;
    lastY = y;
  };

  const checkProgress = (): void => {
    if (revealed) {
      return;
    }
    const ratio = computeClearedRatio(
      ctx.getImageData(0, 0, width, height).data,
      width,
      height
    );
    if (ratio < SCRATCH_REVEAL_RATIO) {
      return;
    }
    revealed = true;
    canvas.classList.add("is-cleared");
    window.setTimeout(options.onRevealed, CLEAR_ANIMATION_MS);
  };

  canvas.addEventListener("pointerdown", (event) => {
    if (revealed || activePointerId !== null) {
      return;
    }
    activePointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    const point = toCanvasPoint(event);
    lastX = point.x;
    lastY = point.y;
    // A tiny offset makes a plain tap leave a round dot.
    scratchTo(point.x + 0.01, point.y);
    event.preventDefault();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointerId) {
      return;
    }
    const point = toCanvasPoint(event);
    scratchTo(point.x, point.y);
    event.preventDefault();
  });

  const endStroke = (event: PointerEvent): void => {
    if (event.pointerId !== activePointerId) {
      return;
    }
    activePointerId = null;
    checkProgress();
  };
  canvas.addEventListener("pointerup", endStroke);
  canvas.addEventListener("pointercancel", endStroke);
}
