import { describe, expect, it } from "vitest";
import { ADVENT_DAYS } from "../src/data/adventDays";
import type { CardType } from "../src/types/advent";

describe("ADVENT_DAYS dataset integrity", () => {
  it("contains exactly 24 unique days ordered from 1 to 24", () => {
    expect(ADVENT_DAYS).toHaveLength(24);
    const days = ADVENT_DAYS.map((entry) => entry.day);
    expect(days).toEqual(Array.from({ length: 24 }, (_, idx) => idx + 1));
  });

  it("covers all seven card formats with non-empty German content", () => {
    const seenTypes = new Set<CardType>();

    for (const entry of ADVENT_DAYS) {
      seenTypes.add(entry.type);
      expect(entry.title.trim().length).toBeGreaterThan(0);
      expect(entry.yearBadge.trim().length).toBeGreaterThan(0);
      expect(entry.message.trim().length).toBeGreaterThan(10);

      if (entry.type === "voucher") {
        expect(entry.voucherCode?.trim().length).toBeGreaterThan(0);
      }
      if (entry.type === "compliment") {
        expect(entry.complimentHighlight?.trim().length).toBeGreaterThan(0);
      }
      if (entry.type === "media") {
        expect(entry.mediaCaption?.trim().length).toBeGreaterThan(0);
      }
      if (entry.type === "map") {
        expect(entry.places?.length ?? 0).toBeGreaterThan(0);
        for (const place of entry.places ?? []) {
          expect(place.name.trim().length).toBeGreaterThan(0);
          expect(Math.abs(place.latitude)).toBeLessThanOrEqual(85);
          expect(Math.abs(place.longitude)).toBeLessThanOrEqual(180);
          expect(place.photos.length).toBeGreaterThan(0);
        }
      }
      if (entry.type === "quiz") {
        const quiz = entry.quiz;
        expect(quiz?.question.trim().length).toBeGreaterThan(0);
        expect(quiz?.options.length ?? 0).toBeGreaterThanOrEqual(2);
        expect(quiz?.correctIndex ?? -1).toBeGreaterThanOrEqual(0);
        expect(quiz?.correctIndex ?? 99).toBeLessThan(quiz?.options.length ?? 0);
      }
    }

    expect(seenTypes).toEqual(
      new Set<CardType>([
        "polaroid",
        "letter",
        "voucher",
        "compliment",
        "media",
        "map",
        "quiz",
      ])
    );
  });
});
