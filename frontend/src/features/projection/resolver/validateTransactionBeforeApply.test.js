import { describe, expect, it } from "vitest";
import { EVENT_TYPES } from "../../../shared/constants/eventTypes";
import { validateTransactionBeforeApply } from "./validateTransactionBeforeApply";

function baseState(overrides = {}) {
  return {
    appearances: {
      appearance_a: {
        id: "appearance_a",
        appearanceId: "appearance_a",
        instrumentId: "instrument_voice",
        participationId: "participation_a",
        played: false,
        locked: false,
      },
      appearance_b: {
        id: "appearance_b",
        appearanceId: "appearance_b",
        instrumentId: "instrument_voice",
        participationId: "participation_b",
        played: false,
        locked: false,
      },
      appearance_c: {
        id: "appearance_c",
        appearanceId: "appearance_c",
        instrumentId: "instrument_guitar",
        participationId: "participation_c",
        played: false,
        locked: false,
      },
      appearance_played: {
        id: "appearance_played",
        appearanceId: "appearance_played",
        instrumentId: "instrument_bass",
        participationId: "participation_played",
        played: true,
        locked: false,
      },
      appearance_locked: {
        id: "appearance_locked",
        appearanceId: "appearance_locked",
        instrumentId: "instrument_bass",
        participationId: "participation_locked",
        played: false,
        locked: true,
      },
    },
    holes: {
      hole_a: {
        id: "hole_a",
        holeId: "hole_a",
        instrumentId: "instrument_voice",
        played: false,
        locked: false,
      },
      hole_played: {
        id: "hole_played",
        holeId: "hole_played",
        instrumentId: "instrument_guitar",
        played: true,
        locked: false,
      },
    },
    participants: {
      participant_a: { id: "participant_a", participantId: "participant_a" },
    },
    participations: {
      participation_a: {
        id: "participation_a",
        participationId: "participation_a",
      },
    },
    links: {
      link_a_c: {
        linkId: "link_a_c",
        status: "active",
        targets: [
          { type: "appearance", id: "appearance_a" },
          { type: "appearance", id: "appearance_c" },
        ],
      },
    },
    conflicts: {
      conflict_a_c: {
        conflictId: "conflict_a_c",
        status: "active",
        targetIds: ["appearance_a", "appearance_c"],
      },
    },
    ...overrides,
  };
}

function tx(type, payload, eventId = `event_${type}`) {
  return {
    transactionId: `transaction_${type}`,
    events: [{ type, eventId, payload }],
  };
}

describe("validateTransactionBeforeApply", () => {
  it("accepts valid transactions", () => {
    expect(
      validateTransactionBeforeApply(
        baseState(),
        tx(EVENT_TYPES.APPEARANCE_MOVED_BETWEEN, {
          appearanceId: "appearance_a",
          afterTarget: null,
          beforeTarget: { type: "appearance", id: "appearance_b" },
        }),
      ),
    ).toEqual({ ok: true, warnings: [] });
  });

  it("refuses manual move of a locked card", () => {
    expect(
      validateTransactionBeforeApply(
        baseState(),
        tx(EVENT_TYPES.APPEARANCE_MOVED_BETWEEN, {
          appearanceId: "appearance_locked",
        }),
      ),
    ).toMatchObject({
      ok: false,
      reason: "card_locked_cannot_move",
      details: { cardId: "appearance_locked" },
    });
  });

  it("refuses manual move of a played card", () => {
    expect(
      validateTransactionBeforeApply(
        baseState(),
        tx(EVENT_TYPES.APPEARANCE_MOVED_BETWEEN, {
          appearanceId: "appearance_played",
        }),
      ),
    ).toMatchObject({
      ok: false,
      reason: "card_played_cannot_move",
      details: { cardId: "appearance_played" },
    });
  });

  it("refuses manual move across columns", () => {
    expect(
      validateTransactionBeforeApply(
        baseState(),
        tx(EVENT_TYPES.APPEARANCE_MOVED_BETWEEN, {
          appearanceId: "appearance_a",
          beforeTarget: { type: "appearance", id: "appearance_c" },
        }),
      ),
    ).toMatchObject({ ok: false, reason: "move_changes_column" });
  });

  it("refuses links between cards in the same column", () => {
    expect(
      validateTransactionBeforeApply(
        baseState(),
        tx(EVENT_TYPES.LINK_CREATED, {
          linkId: "link_same_column",
          targets: [
            { type: "appearance", id: "appearance_a" },
            { type: "appearance", id: "appearance_b" },
          ],
        }),
      ),
    ).toMatchObject({
      ok: false,
      reason: "link_targets_same_column",
      details: {
        cardIds: ["appearance_a", "appearance_b"],
        columnId: "instrument_voice",
      },
    });
  });

  it("refuses links between cards already in direct conflict", () => {
    expect(
      validateTransactionBeforeApply(
        baseState(),
        tx(EVENT_TYPES.LINK_CREATED, {
          linkId: "link_conflicted",
          targets: [
            { type: "appearance", id: "appearance_a" },
            { type: "appearance", id: "appearance_c" },
          ],
        }),
      ),
    ).toMatchObject({ ok: false, reason: "link_targets_direct_conflict" });
  });

  it("refuses conflicts between cards already linked", () => {
    expect(
      validateTransactionBeforeApply(
        baseState(),
        tx(EVENT_TYPES.CONFLICT_CREATED, {
          conflictId: "conflict_linked",
          targetCardIds: ["appearance_a", "appearance_c"],
          scope: "appearance",
          reason: "manual",
        }),
      ),
    ).toMatchObject({ ok: false, reason: "conflict_targets_same_link_group" });
  });

  it("refuses deletion of a played appearance", () => {
    expect(
      validateTransactionBeforeApply(
        baseState(),
        tx(EVENT_TYPES.APPEARANCE_REMOVED, {
          appearanceId: "appearance_played",
        }),
      ),
    ).toMatchObject({
      ok: false,
      reason: "played_card_cannot_be_deleted",
    });
  });

  it("refuses deletion of a played hole", () => {
    expect(
      validateTransactionBeforeApply(
        baseState(),
        tx(EVENT_TYPES.HOLE_REMOVED, { holeId: "hole_played" }),
      ),
    ).toMatchObject({
      ok: false,
      reason: "played_hole_cannot_be_deleted",
    });
  });

  it("refuses lock or unlock when target is missing", () => {
    expect(
      validateTransactionBeforeApply(
        baseState(),
        tx(EVENT_TYPES.APPEARANCE_LOCKED, {
          appearanceId: "missing_appearance",
        }),
      ),
    ).toMatchObject({ ok: false, reason: "missing_target" });
    expect(
      validateTransactionBeforeApply(
        baseState(),
        tx(EVENT_TYPES.HOLE_UNLOCKED, { holeId: "missing_hole" }),
      ),
    ).toMatchObject({ ok: false, reason: "missing_target" });
  });

  it("refuses unsupported event types", () => {
    expect(
      validateTransactionBeforeApply(
        baseState(),
        tx("participant_left", { participantId: "participant_a" }),
      ),
    ).toMatchObject({
      ok: false,
      reason: "unsupported_event_type",
      details: { eventType: "participant_left" },
    });
  });

  it("refuses invalid or missing target IDs for destructive actions", () => {
    expect(
      validateTransactionBeforeApply(
        baseState(),
        tx(EVENT_TYPES.APPEARANCE_REMOVED, {
          appearanceId: "missing_appearance",
        }),
      ),
    ).toMatchObject({ ok: false, reason: "missing_target" });
    expect(
      validateTransactionBeforeApply(
        baseState(),
        tx(EVENT_TYPES.HOLE_REMOVED, { holeId: "missing_hole" }),
      ),
    ).toMatchObject({ ok: false, reason: "missing_target" });
    expect(
      validateTransactionBeforeApply(
        baseState(),
        tx(EVENT_TYPES.PARTICIPANT_REMOVED, {
          participantId: "missing_participant",
        }),
      ),
    ).toMatchObject({ ok: false, reason: "missing_target" });
    expect(
      validateTransactionBeforeApply(
        baseState(),
        tx(EVENT_TYPES.PARTICIPATION_REMOVED, {
          participationId: "missing_participation",
        }),
      ),
    ).toMatchObject({ ok: false, reason: "missing_target" });
  });

  it("refuses skipped targets that are played or locked", () => {
    expect(
      validateTransactionBeforeApply(
        baseState(),
        tx(EVENT_TYPES.APPEARANCE_SKIPPED, {
          appearanceId: "appearance_played",
        }),
      ),
    ).toMatchObject({ ok: false, reason: "skip_target_played" });
    expect(
      validateTransactionBeforeApply(
        baseState(),
        tx(EVENT_TYPES.APPEARANCE_SKIPPED, {
          appearanceId: "appearance_locked",
        }),
      ),
    ).toMatchObject({ ok: false, reason: "skip_target_locked" });
  });

  it("stops at the first invalid event in a multi-event transaction", () => {
    expect(
      validateTransactionBeforeApply(baseState(), {
        transactionId: "transaction_multi",
        events: [
          {
            type: EVENT_TYPES.APPEARANCE_MOVED_BETWEEN,
            eventId: "event_move",
            payload: { appearanceId: "appearance_locked" },
          },
          {
            type: EVENT_TYPES.LINK_CREATED,
            eventId: "event_link",
            payload: {
              targets: [
                { type: "appearance", id: "appearance_a" },
                { type: "appearance", id: "appearance_b" },
              ],
            },
          },
        ],
      }),
    ).toMatchObject({
      ok: false,
      reason: "card_locked_cannot_move",
      details: { transactionId: "transaction_multi", eventId: "event_move" },
    });
  });
});
