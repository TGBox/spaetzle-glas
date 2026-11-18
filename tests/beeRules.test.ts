import { describe, expect, it } from "vitest";
import {
  evaluateBeeGuess,
  getBeeMaxScore,
  getBeeScore,
  isBeePangram,
  isBeeSolved,
  maskBeeWord,
  normalizeBeeWord,
  scoreBeeWord,
} from "../src/domain/beeRules";
import type { BeePuzzle } from "../src/types/advent";

const strassburg: BeePuzzle = {
  letters: "STRAßBURG",
  center: "U",
  words: [
    { word: "STRAßBURG", special: true },
    { word: "BUS", special: true },
    { word: "GRUß" },
    { word: "BURG" },
    { word: "SURRT" },
  ],
};

const letters = Array.from("STRAßBURG");

describe("normalizeBeeWord", () => {
  it("uppercases without turning ß into SS", () => {
    expect(normalizeBeeWord(" straßburg ")).toBe("STRAßBURG");
    expect(normalizeBeeWord("GRUẞ")).toBe("GRUß");
    expect(normalizeBeeWord("klöpfer")).toBe("KLÖPFER");
  });
});

describe("scoreBeeWord", () => {
  it("follows the Buchstabiene point rules", () => {
    expect(scoreBeeWord("BUS", letters)).toBe(2);
    expect(scoreBeeWord("BURG", letters)).toBe(3);
    expect(scoreBeeWord("SURRT", letters)).toBe(5);
    expect(scoreBeeWord("STRAßBURG", letters)).toBe(12);
  });

  it("detects pangrams only when every tile is used", () => {
    expect(isBeePangram("STRAßBURG", letters)).toBe(true);
    expect(isBeePangram("BURG", letters)).toBe(false);
  });
});

describe("evaluateBeeGuess", () => {
  it("reports rule violations before checking the word list", () => {
    expect(evaluateBeeGuess(strassburg, "BU", []).kind).toBe("too_short");
    expect(evaluateBeeGuess(strassburg, "GRAS", []).kind).toBe("missing_center");
    expect(evaluateBeeGuess(strassburg, "BUSS", []).kind).toBe("invalid_letters");
    expect(evaluateBeeGuess(strassburg, "STUR", []).kind).toBe("not_in_list");
  });

  it("allows a doubled tile to be used twice", () => {
    const result = evaluateBeeGuess(strassburg, "surrt", []);
    expect(result.kind).toBe("found");
  });

  it("returns points, pangram and special flags for listed words", () => {
    const result = evaluateBeeGuess(strassburg, "straßburg", []);
    expect(result).toEqual({
      kind: "found",
      word: "STRAßBURG",
      points: 12,
      isPangram: true,
      isSpecial: true,
    });
    expect(evaluateBeeGuess(strassburg, "BUS", ["BUS"]).kind).toBe(
      "already_found"
    );
  });
});

describe("progress", () => {
  it("sums current and maximum scores", () => {
    expect(getBeeMaxScore(strassburg)).toBe(12 + 2 + 3 + 3 + 5);
    expect(getBeeScore(strassburg, ["BUS", "BURG"])).toBe(5);
  });

  it("is solved by the pangram when the puzzle has one", () => {
    expect(isBeeSolved(strassburg, ["BUS", "GRUß", "BURG"])).toBe(false);
    expect(isBeeSolved(strassburg, ["STRAßBURG"])).toBe(true);
  });

  it("is solved by all special words when there is no pangram", () => {
    const noPangram: BeePuzzle = {
      letters: "BRIEFKLÖP",
      center: "E",
      words: [
        { word: "BRIEF", special: true },
        { word: "KLÖPFER", special: true },
        { word: "ELF" },
      ],
    };
    expect(isBeeSolved(noPangram, ["BRIEF", "ELF"])).toBe(false);
    expect(isBeeSolved(noPangram, ["BRIEF", "KLÖPFER"])).toBe(true);
  });

  it("masks hints down to the first letter", () => {
    expect(maskBeeWord("brust")).toBe("B _ _ _ _");
  });
});
