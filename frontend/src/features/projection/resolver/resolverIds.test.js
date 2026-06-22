import { describe, expect, it } from "vitest";
import {
  makeAppearanceId,
  makeCardIdFromAppearanceId,
  makeCardIdFromHoleId,
  parseCardId,
} from "./resolverIds";

describe("resolverIds", () => {
  it("builds deterministic canonical appearance ids", () => {
    expect(makeAppearanceId("participation_A_voice", 1)).toBe(
      "appearance_participation_A_voice_1",
    );
    expect(makeAppearanceId("participation_A_voice", 2)).toBe(
      "appearance_participation_A_voice_2",
    );
  });

  it("uses canonical appearance and hole ids as resolver card ids", () => {
    expect(
      makeCardIdFromAppearanceId("appearance_participation_A_voice_1"),
    ).toBe("appearance_participation_A_voice_1");
    expect(makeCardIdFromHoleId("hole_empty_guitar_1")).toBe(
      "hole_empty_guitar_1",
    );
  });

  it("parses resolver card ids deterministically", () => {
    expect(parseCardId("appearance_participation_A_voice_1")).toEqual({
      cardId: "appearance_participation_A_voice_1",
      type: "appearance",
      appearanceId: "appearance_participation_A_voice_1",
      holeId: null,
    });
    expect(parseCardId("hole_empty_guitar_1")).toEqual({
      cardId: "hole_empty_guitar_1",
      type: "hole",
      appearanceId: null,
      holeId: "hole_empty_guitar_1",
    });
  });

  it("rejects malformed resolver ids", () => {
    expect(() => makeAppearanceId("", 1)).toThrow(/participationId/);
    expect(() => makeAppearanceId("participation_A_voice", 0)).toThrow(
      /appearanceIndex/,
    );
    expect(() => makeCardIdFromAppearanceId("hole_not_appearance")).toThrow(
      /appearance_/,
    );
    expect(() => makeCardIdFromHoleId("appearance_not_hole")).toThrow(/hole_/);
    expect(() => parseCardId("participant_unknown")).toThrow(
      /Unknown resolver card id/,
    );
  });
});
