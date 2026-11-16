import { describe, expect, it } from "vitest";
import { ADVENT_DAYS } from "../src/data/adventDays";
import { createDefaultAppState } from "../src/domain/storage";
import { buildPrintBookHtml } from "../src/ui/printBook";
import { computeClearedRatio } from "../src/ui/scratchCard";

describe("computeClearedRatio", () => {
  it("reports the share of fully transparent pixels", () => {
    const width = 4;
    const height = 2;
    const rgba = new Uint8ClampedArray(width * height * 4).fill(255);
    expect(computeClearedRatio(rgba, width, height, 1)).toBe(0);

    // Clear the alpha channel of the left half.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < 2; x++) {
        rgba[(y * width + x) * 4 + 3] = 0;
      }
    }
    expect(computeClearedRatio(rgba, width, height, 1)).toBe(0.5);
  });
});

describe("buildPrintBookHtml", () => {
  const voucherDay = ADVENT_DAYS.find((day) => day.type === "voucher");
  const quizDay = ADVENT_DAYS.find((day) => day.type === "quiz");
  const mapDay = ADVENT_DAYS.find((day) => day.type === "map");

  it("contains only opened days so nothing is spoiled", () => {
    const state = { ...createDefaultAppState(), openedDays: [1, 2] };
    const html = buildPrintBookHtml(ADVENT_DAYS, state);

    expect(html).toContain("1. Dezember");
    expect(html).toContain("2. Dezember");
    expect(html).not.toContain("3. Dezember");
    expect(html.split('class="print-page"').length - 1).toBe(2);
  });

  it("keeps unscratched vouchers and unsolved quizzes hidden, then shows them", () => {
    if (!voucherDay || !quizDay) {
      throw new Error("dataset is missing a voucher or quiz day");
    }
    const openedOnly = {
      ...createDefaultAppState(),
      openedDays: [voucherDay.day, quizDay.day],
    };
    const hiddenHtml = buildPrintBookHtml(ADVENT_DAYS, openedOnly);
    expect(hiddenHtml).not.toContain(voucherDay.voucherCode ?? "__none__");
    expect(hiddenHtml).not.toContain("Richtige Antwort");

    const revealed = {
      ...openedOnly,
      scratchedVouchers: [voucherDay.day],
      solvedQuizzes: [quizDay.day],
    };
    const revealedHtml = buildPrintBookHtml(ADVENT_DAYS, revealed);
    expect(revealedHtml).toContain("Richtige Antwort");
    expect(revealedHtml).toContain("Gutschein-Code");
  });

  it("lists every photo of every place on the map day and escapes text", () => {
    if (!mapDay) {
      throw new Error("dataset is missing a map day");
    }
    const state = { ...createDefaultAppState(), openedDays: [mapDay.day] };
    const html = buildPrintBookHtml(ADVENT_DAYS, state);
    const photoCount = (mapDay.places ?? []).reduce(
      (sum, entry) => sum + entry.photos.length,
      0
    );
    expect(html.split('class="print-photo"').length - 1).toBe(photoCount);

    const tricky = buildPrintBookHtml(
      [{ ...ADVENT_DAYS[0], title: "<b>Hallo</b>" }],
      { ...createDefaultAppState(), openedDays: [1] }
    );
    expect(tricky).not.toContain("<b>Hallo</b>");
  });
});
