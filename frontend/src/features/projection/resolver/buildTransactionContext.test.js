import { describe, expect, it } from "vitest";
import {
  ALLOWED_EVENT_TYPES,
  EVENT_TYPES,
} from "../../../shared/constants/eventTypes";
import {
  assertTransactionContextCoverage,
  buildTransactionContext,
  TRANSACTION_CONTEXT_EVENT_TYPES,
} from "./buildTransactionContext";

const REQUIRED_CONTEXT_KEYS = [
  "intent",
  "anchorCardId",
  "affectedCardIds",
  "afterTargetCardId",
  "beforeTargetCardId",
  "preferredResolvedRow",
  "playedResolvedRow",
  "skippedCardId",
  "createdHoleId",
  "removedLinkIds",
  "validationHints",
  "possibleWarnings",
];

const BASE_STATE = {
  previousLayout: {
    byCardId: {
      appearance_a: { cardId: "appearance_a", resolvedRow: 4 },
      hole_a: { cardId: "hole_a", resolvedRow: 5 },
    },
  },
  appearances: {
    appearance_a: {
      id: "appearance_a",
      appearanceId: "appearance_a",
      instrumentId: "instrument_voice",
      participantId: "participant_a",
      participationId: "participation_a",
      played: false,
    },
    appearance_b: {
      id: "appearance_b",
      appearanceId: "appearance_b",
      instrumentId: "instrument_voice",
      participantId: "participant_a",
      participationId: "participation_a",
      played: false,
    },
    appearance_c: {
      id: "appearance_c",
      appearanceId: "appearance_c",
      instrumentId: "instrument_guitar",
      participantId: "participant_b",
      participationId: "participation_b",
      played: false,
    },
  },
  holes: {
    hole_a: {
      id: "hole_a",
      holeId: "hole_a",
      instrumentId: "instrument_voice",
    },
  },
};

function tx(type, payload = {}, extra = {}) {
  return {
    transactionId: `transaction_${type}`,
    events: [
      {
        type,
        eventId: `event_${type}`,
        eventIndexInTransaction: 0,
        payload,
        ...extra,
      },
    ],
  };
}

function samplePayload(type) {
  switch (type) {
    case EVENT_TYPES.JAM_CREATED:
      return { jamId: "jam_1" };
    case EVENT_TYPES.JAM_UPDATED:
      return { jamId: "jam_1", name: "Updated" };
    case EVENT_TYPES.INSTRUMENT_ADDED:
    case EVENT_TYPES.INSTRUMENT_UPDATED:
      return { instrumentId: "instrument_voice" };
    case EVENT_TYPES.INSTRUMENTS_REORDERED:
      return {
        orderedInstrumentIds: ["instrument_voice", "instrument_guitar"],
      };
    case EVENT_TYPES.INSTRUMENT_VISIBILITY_CHANGED:
      return { instrumentId: "instrument_voice", visible: false };
    case EVENT_TYPES.JAM_LINK_REORDER_STRATEGY_CHANGED:
      return { nextStrategy: "move_to_last" };
    case EVENT_TYPES.PARTICIPANT_CREATED:
    case EVENT_TYPES.PARTICIPANT_UPDATED:
    case EVENT_TYPES.PARTICIPANT_REMOVED:
    case EVENT_TYPES.PARTICIPANT_MARKED_LEFT:
      return { participantId: "participant_a" };
    case EVENT_TYPES.PARTICIPATION_ADDED:
      return {
        participationId: "participation_new",
        createdAppearanceIds: ["appearance_new_1"],
      };
    case EVENT_TYPES.PARTICIPATION_REMOVED:
      return { participationId: "participation_a" };
    case EVENT_TYPES.APPEARANCE_MATERIALIZED:
    case EVENT_TYPES.APPEARANCE_REMOVED:
    case EVENT_TYPES.APPEARANCE_LOCKED:
    case EVENT_TYPES.APPEARANCE_UNLOCKED:
      return { appearanceId: "appearance_a" };
    case EVENT_TYPES.APPEARANCE_MOVED_BETWEEN:
      return {
        appearanceId: "appearance_a",
        afterTarget: { type: "appearance", id: "appearance_b" },
        beforeTarget: { type: "appearance", id: "appearance_c" },
      };
    case EVENT_TYPES.APPEARANCE_SKIPPED:
      return {
        appearanceId: "appearance_a",
        replacementCardId: "appearance_b",
        preferredResolvedRow: 6,
        removedLinkIds: ["link_a_b"],
      };
    case EVENT_TYPES.HOLE_ADDED:
      return { holeId: "hole_new", reason: "manual", preferredResolvedRow: 3 };
    case EVENT_TYPES.HOLE_REMOVED:
    case EVENT_TYPES.HOLE_LOCKED:
    case EVENT_TYPES.HOLE_UNLOCKED:
      return { holeId: "hole_a" };
    case EVENT_TYPES.HOLE_MOVED_BETWEEN:
      return {
        holeId: "hole_a",
        afterTarget: { type: "appearance", id: "appearance_a" },
        beforeTarget: { type: "appearance", id: "appearance_b" },
      };
    case EVENT_TYPES.LINK_CREATED:
      return {
        linkId: "link_a_c",
        targetCardIds: ["appearance_a", "appearance_c"],
        reorderStrategy: "move_to_first",
      };
    case EVENT_TYPES.LINK_REMOVED:
      return {
        linkId: "link_a_c",
        targetCardIds: ["appearance_a", "appearance_c"],
      };
    case EVENT_TYPES.CONFLICT_CREATED:
      return {
        conflictId: "conflict_a_c",
        scope: "appearance",
        targetCardIds: ["appearance_a", "appearance_c"],
        reason: "manual",
      };
    case EVENT_TYPES.CONFLICT_REMOVED:
      return {
        conflictId: "conflict_a_c",
        targetCardIds: ["appearance_a", "appearance_c"],
      };
    case EVENT_TYPES.INSTRUMENT_ROUND_VISIBILITY_CHANGED:
      return {
        instrumentId: "instrument_voice",
        createdAppearanceIds: ["appearance_new_round_2"],
        visibleAppearanceIndexes: [2],
      };
    case EVENT_TYPES.PLATEAU_PLAYED:
      return {
        visualIndex: 2,
        playedResolvedRow: 4,
        targets: [{ type: "appearance", id: "appearance_a" }],
      };
    case EVENT_TYPES.PLATEAU_UNPLAYED:
      return { targets: [{ type: "appearance", id: "appearance_a" }] };
    case EVENT_TYPES.TRANSACTION_REVERTED:
      return {
        revertedTransactionId: "transaction_old",
        affectedCardIds: ["appearance_a"],
      };
    case EVENT_TYPES.TRANSACTION_REDONE:
      return {
        redoneTransactionId: "transaction_old",
        affectedCardIds: ["appearance_a"],
      };
    default:
      throw new Error(`Missing sample payload for ${type}`);
  }
}

describe("buildTransactionContext", () => {
  it("has explicit coverage for every allowed V0 event type", () => {
    expect(assertTransactionContextCoverage()).toBe(true);
    expect(TRANSACTION_CONTEXT_EVENT_TYPES).toEqual(ALLOWED_EVENT_TYPES);
  });

  it("returns all canonical context fields for every allowed event type", () => {
    ALLOWED_EVENT_TYPES.forEach((type) => {
      const context = buildTransactionContext(
        BASE_STATE,
        tx(type, samplePayload(type)),
      );
      REQUIRED_CONTEXT_KEYS.forEach((key) =>
        expect(context).toHaveProperty(key),
      );
      expect(context.transactionId).toBe(`transaction_${type}`);
      expect(context.eventIds).toEqual([`event_${type}`]);
      expect(Array.isArray(context.affectedCardIds)).toBe(true);
      expect(Array.isArray(context.removedLinkIds)).toBe(true);
      expect(Array.isArray(context.validationHints)).toBe(true);
      expect(Array.isArray(context.possibleWarnings)).toBe(true);
    });
  });

  it("maps move events to bounds and affected cards", () => {
    expect(
      buildTransactionContext(
        BASE_STATE,
        tx(
          EVENT_TYPES.APPEARANCE_MOVED_BETWEEN,
          samplePayload(EVENT_TYPES.APPEARANCE_MOVED_BETWEEN),
        ),
      ),
    ).toMatchObject({
      intent: "move",
      anchorCardId: "appearance_a",
      affectedCardIds: ["appearance_a", "appearance_b", "appearance_c"],
      afterTargetCardId: "appearance_b",
      beforeTargetCardId: "appearance_c",
      possibleWarnings: [
        "missing_target:move_target_missing",
        "invalid_action_replayed:fixed_card_move_refused",
      ],
    });
  });

  it("merges multi-event transactions once using documented intent priority", () => {
    const context = buildTransactionContext(BASE_STATE, {
      transactionId: "transaction_multi",
      events: [
        {
          type: EVENT_TYPES.LINK_CREATED,
          eventId: "event_link",
          eventIndexInTransaction: 0,
          payload: samplePayload(EVENT_TYPES.LINK_CREATED),
        },
        {
          type: EVENT_TYPES.APPEARANCE_MOVED_BETWEEN,
          eventId: "event_move",
          eventIndexInTransaction: 1,
          payload: samplePayload(EVENT_TYPES.APPEARANCE_MOVED_BETWEEN),
        },
      ],
    });

    expect(context.intent).toBe("move");
    expect(context.eventIds).toEqual(["event_link", "event_move"]);
    expect(context.anchorCardId).toBe("appearance_a");
    expect(context.affectedCardIds).toEqual([
      "appearance_a",
      "appearance_c",
      "appearance_b",
    ]);
    expect(context.metadata.linkId).toBe("link_a_c");
  });

  it("folds appearance_skipped + link_removed + hole_added into one skip context", () => {
    const context = buildTransactionContext(BASE_STATE, {
      transactionId: "transaction_skip",
      events: [
        {
          type: EVENT_TYPES.LINK_REMOVED,
          eventId: "event_link_removed",
          eventIndexInTransaction: 0,
          payload: {
            linkId: "link_a_b",
            targetCardIds: ["appearance_a", "appearance_b"],
          },
        },
        {
          type: EVENT_TYPES.HOLE_ADDED,
          eventId: "event_hole",
          eventIndexInTransaction: 1,
          payload: {
            holeId: "hole_skip",
            reason: "played_empty_slot",
            targetResolvedRow: 7,
          },
        },
        {
          type: EVENT_TYPES.APPEARANCE_SKIPPED,
          eventId: "event_skip",
          eventIndexInTransaction: 2,
          payload: {
            appearanceId: "appearance_a",
            removedLinkIds: ["link_a_b"],
            preferredResolvedRow: 7,
          },
        },
      ],
    });

    expect(context.intent).toBe("skip");
    expect(context.skippedCardId).toBe("appearance_a");
    expect(context.createdHoleId).toBe("hole_skip");
    expect(context.removedLinkIds).toEqual(["link_a_b"]);
    expect(context.affectedCardIds).toEqual([
      "appearance_a",
      "appearance_b",
      "hole_skip",
    ]);
  });

  it("uses playedResolvedRow for plateau_played and ignores local plateauIndex", () => {
    const context = buildTransactionContext(
      BASE_STATE,
      tx(EVENT_TYPES.PLATEAU_PLAYED, {
        plateauIndex: 99,
        visualIndex: 3,
        playedResolvedRow: 8,
        targets: [{ type: "appearance", id: "appearance_a" }],
      }),
    );

    expect(context).toMatchObject({
      intent: "play",
      playedResolvedRow: 8,
      affectedCardIds: ["appearance_a"],
    });
    expect(context.metadata).toMatchObject({
      visualIndex: 3,
      playedResolvedRow: 8,
    });
    expect(context.metadata.plateauIndex).toBeUndefined();
  });

  it("uses previous resolved rows for lock contexts", () => {
    expect(
      buildTransactionContext(
        BASE_STATE,
        tx(EVENT_TYPES.APPEARANCE_LOCKED, { appearanceId: "appearance_a" }),
      ),
    ).toMatchObject({
      intent: "lock",
      anchorCardId: "appearance_a",
      preferredResolvedRow: 4,
    });
    expect(
      buildTransactionContext(
        BASE_STATE,
        tx(EVENT_TYPES.HOLE_LOCKED, { holeId: "hole_a" }),
      ),
    ).toMatchObject({
      intent: "lock",
      anchorCardId: "hole_a",
      preferredResolvedRow: 5,
    });
  });

  it("rejects old alias event types instead of mapping them into context", () => {
    [
      "participant_left",
      "round_revealed",
      "column_hidden",
      "column_shown",
    ].forEach((type) => {
      expect(() => buildTransactionContext(BASE_STATE, tx(type, {}))).toThrow(
        /Unsupported V0 event type/,
      );
    });
  });
});
