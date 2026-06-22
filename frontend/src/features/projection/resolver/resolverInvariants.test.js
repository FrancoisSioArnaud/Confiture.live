import { describe, expect, it } from "vitest";
import { projectJamState } from "../projectJamState";
import { createTransaction } from "../../transactions/createTransaction";
import {
  instrumentAdded,
  jamCreated,
  participantCreated,
  participationAdded,
} from "../../transactions/eventFactories";
import { resolveOrderAfterTransactionV2 } from "./resolveOrderAfterTransactionV2";
import { isKnownResolverWarning } from "./resolverWarnings";

const SEEDS = [11, 23, 37, 101];
const COLUMNS = ["instrument_voice", "instrument_guitar", "instrument_bass"];
const HIDDEN_COLUMN = "instrument_hidden";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function deterministicShuffle(values, seed) {
  const rng = makeRng(seed);
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function makeCard(seed, columnId, row, overrides = {}) {
  const shortColumn = columnId.replace("instrument_", "");
  const cardId = `s${seed}_${shortColumn}_${row}`;
  return {
    cardId,
    type: overrides.type ?? "appearance",
    columnId,
    participantId: overrides.participantId ?? `participant_${shortColumn}_${row}`,
    participationId: overrides.participationId ?? `participation_${shortColumn}_${row}`,
    appearanceId: overrides.type === "hole" ? null : cardId,
    holeId: overrides.type === "hole" ? cardId : null,
    appearanceIndex: row,
    createdAtOrder: row,
    baseOrder: row,
    previousResolvedRow: row,
    resolvedRow: row,
    visualIndex: null,
    cardIndexInColumn: null,
    played: false,
    locked: false,
    deleted: false,
    hidden: false,
    sourceEventId: `event_${seed}_${shortColumn}_${row}`,
    sourceTransactionId: `transaction_${seed}`,
    ...overrides,
  };
}

function makeInput(seed, overrides = {}) {
  const visibleCards = COLUMNS.flatMap((columnId) =>
    [1, 2, 3, 4, 5].map((row) =>
      makeCard(seed, columnId, row, {
        played: columnId === "instrument_voice" && row === 1,
        locked: columnId === "instrument_voice" && row === 5,
      }),
    ),
  );
  const hiddenCards = [
    makeCard(seed, HIDDEN_COLUMN, 1, { hidden: true }),
    makeCard(seed, HIDDEN_COLUMN, 2, { hidden: true }),
  ];
  const cards = [...visibleCards, ...hiddenCards];
  const previousLayout = {
    byCardId: Object.fromEntries(
      cards.map((card) => [card.cardId, { resolvedRow: card.previousResolvedRow }]),
    ),
  };
  const links = [
    {
      linkId: `link_${seed}_voice_guitar_row2`,
      targetCardIds: [`s${seed}_voice_2`, `s${seed}_guitar_2`],
      active: true,
      reorderStrategy: "move_to_first",
    },
    {
      linkId: `link_${seed}_guitar_bass_row4`,
      targetCardIds: [`s${seed}_guitar_4`, `s${seed}_bass_4`],
      active: true,
      reorderStrategy: "move_to_first",
    },
    {
      linkId: `link_${seed}_visible_hidden_ignored`,
      targetCardIds: [`s${seed}_bass_5`, `s${seed}_hidden_1`],
      active: true,
      reorderStrategy: "move_to_first",
    },
  ];
  const conflicts = [
    {
      conflictId: `conflict_${seed}_voice_bass_row3`,
      scope: "appearance",
      targetCardIds: [`s${seed}_voice_3`, `s${seed}_bass_3`],
      active: true,
      reason: "manual",
    },
    {
      conflictId: `conflict_${seed}_visible_hidden_ignored`,
      scope: "appearance",
      targetCardIds: [`s${seed}_guitar_5`, `s${seed}_hidden_2`],
      active: true,
      reason: "manual",
    },
  ];

  return {
    cards,
    links,
    conflicts,
    hiddenColumnIds: [HIDDEN_COLUMN],
    previousLayout,
    transactionContext: {
      transactionId: `transaction_${seed}`,
      eventIds: [`event_${seed}`],
      intent: "neutral",
      anchorCardId: null,
      affectedCardIds: [],
      afterTargetCardId: null,
      beforeTargetCardId: null,
      preferredResolvedRow: null,
      playedResolvedRow: null,
      skippedCardId: null,
      createdHoleId: null,
      removedLinkIds: [],
      validationHints: [],
      warnings: [],
    },
    config: { defaultLinkReorderStrategy: "move_to_first" },
    ...overrides,
  };
}

function visibleCards(input) {
  const hidden = new Set(input.hiddenColumnIds ?? []);
  return (input.cards ?? []).filter(
    (card) =>
      card.deleted !== true && card.hidden !== true && !hidden.has(card.columnId),
  );
}

function visibleCardIdSet(input) {
  return new Set(visibleCards(input).map((card) => card.cardId));
}

function visibleLayout(result, input) {
  const ids = visibleCardIdSet(input);
  return Object.fromEntries(
    Object.entries(result.layoutByCardId)
      .filter(([cardId]) => ids.has(cardId))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

function expectNoVisibleColumnCollisions(result, input) {
  const byCardId = new Map(visibleCards(input).map((card) => [card.cardId, card]));
  const occupied = new Map();
  Object.entries(result.layoutByCardId).forEach(([cardId, layout]) => {
    const card = byCardId.get(cardId);
    if (!card) return;
    const key = `${card.columnId}:${layout.resolvedRow}`;
    expect(occupied.get(key)).toBeUndefined();
    occupied.set(key, cardId);
  });
}

function expectVisibleCardsPreserved(result, input) {
  visibleCards(input).forEach((card) => {
    expect(result.layoutByCardId[card.cardId]).toBeDefined();
  });
}

function expectResolvableLinksAligned(result, input) {
  const ids = visibleCardIdSet(input);
  (input.links ?? []).forEach((link) => {
    const targets = (link.targetCardIds ?? []).filter((cardId) => ids.has(cardId));
    if (link.active !== true || targets.length < 2) return;
    const rows = new Set(
      targets.map((cardId) => result.layoutByCardId[cardId]?.resolvedRow),
    );
    expect([...rows]).toHaveLength(1);
  });
}

function expectResolvableConflictsSeparated(result, input) {
  const ids = visibleCardIdSet(input);
  (input.conflicts ?? []).forEach((conflict) => {
    const targets = (conflict.targetCardIds ?? []).filter((cardId) => ids.has(cardId));
    if (conflict.active !== true || targets.length < 2) return;
    for (let left = 0; left < targets.length; left += 1) {
      for (let right = left + 1; right < targets.length; right += 1) {
        expect(result.layoutByCardId[targets[left]].resolvedRow).not.toBe(
          result.layoutByCardId[targets[right]].resolvedRow,
        );
      }
    }
  });
}

function expectWarningsInCatalog(result) {
  result.projectionWarnings.forEach((warning) => {
    expect(isKnownResolverWarning(warning.type, warning.reason)).toBe(true);
  });
}

function normalizedWarnings(result) {
  return result.projectionWarnings.map(
    ({ type, reason, severity, cardIds, linkIds, conflictIds, columnIds }) => ({
      type,
      reason,
      severity,
      cardIds,
      linkIds,
      conflictIds,
      columnIds,
    }),
  );
}

function withPreviousLayout(input, layoutByCardId, nextContext = {}) {
  return {
    ...clone(input),
    previousLayout: { byCardId: clone(layoutByCardId) },
    transactionContext: {
      ...clone(input.transactionContext),
      transactionId: `${input.transactionContext.transactionId}_next`,
      ...nextContext,
    },
  };
}

function stripHiddenConstraints(input) {
  const visibleIds = visibleCardIdSet(input);
  return {
    ...clone(input),
    cards: clone(input.cards).filter((card) => visibleIds.has(card.cardId)),
    links: clone(input.links).filter((link) =>
      (link.targetCardIds ?? []).every((cardId) => visibleIds.has(cardId)),
    ),
    conflicts: clone(input.conflicts).filter((conflict) =>
      (conflict.targetCardIds ?? []).every((cardId) => visibleIds.has(cardId)),
    ),
    hiddenColumnIds: [],
  };
}

function reorderInputObjects(input, seed) {
  const previousEntries = deterministicShuffle(
    Object.entries(input.previousLayout.byCardId),
    seed + 997,
  );
  return {
    ...clone(input),
    cards: deterministicShuffle(input.cards, seed + 1),
    links: deterministicShuffle(input.links, seed + 2),
    conflicts: deterministicShuffle(input.conflicts, seed + 3),
    previousLayout: { byCardId: Object.fromEntries(previousEntries) },
  };
}

function makeReplayTransactions() {
  const now = "2026-01-01T00:00:00.000Z";
  return [
    createTransaction({
      transactionId: "tx_replay_1",
      createdAt: now,
      jamId: "jam_replay",
      clientId: "client_replay",
      clientSequenceNumber: 1,
      events: [
        jamCreated({
          jamId: "jam_replay",
          name: "Replay invariant jam",
          indicativeDate: null,
          linkReorderStrategy: "move_to_first",
        }),
        instrumentAdded({
          instrumentId: "instrument_voice",
          label: "Voice",
          orderKey: "a",
          visible: true,
          isDefault: true,
        }),
        instrumentAdded({
          instrumentId: "instrument_guitar",
          label: "Guitar",
          orderKey: "b",
          visible: true,
          isDefault: false,
        }),
        participantCreated({ participantId: "participant_a", name: "A" }),
        participantCreated({ participantId: "participant_b", name: "B" }),
      ],
    }),
    createTransaction({
      transactionId: "tx_replay_2",
      createdAt: now,
      jamId: "jam_replay",
      clientId: "client_replay",
      clientSequenceNumber: 2,
      events: [
        participationAdded({
          participationId: "participation_a_voice",
          participantId: "participant_a",
          instrumentId: "instrument_voice",
          customInstrumentLabel: null,
          insertionMode: "end_of_visible_rounds",
          startAppearanceIndex: 1,
          afterTarget: null,
          beforeTarget: null,
          baseOrderKey: "a",
        }),
        participationAdded({
          participationId: "participation_b_guitar",
          participantId: "participant_b",
          instrumentId: "instrument_guitar",
          customInstrumentLabel: null,
          insertionMode: "end_of_visible_rounds",
          startAppearanceIndex: 1,
          afterTarget: null,
          beforeTarget: null,
          baseOrderKey: "b",
        }),
      ],
    }),
  ];
}

describe("resolver invariants", () => {
  const inputs = SEEDS.map((seed) => makeInput(seed));

  it("returns the same output for the same input", () => {
    inputs.forEach((input) => {
      const first = resolveOrderAfterTransactionV2(clone(input));
      const second = resolveOrderAfterTransactionV2(clone(input));
      expect(second).toEqual(first);
    });
  });

  it("replays the same event log to the same layout", () => {
    const transactions = makeReplayTransactions();
    const first = projectJamState({ transactions });
    const second = projectJamState({ transactions });
    expect(second.layoutByCardId).toEqual(first.layoutByCardId);
    expect(second.orderedCardIdsByColumnId).toEqual(
      first.orderedCardIdsByColumnId,
    );
  });

  it("preserves core visible layout invariants across deterministic seeds", () => {
    inputs.forEach((input) => {
      const result = resolveOrderAfterTransactionV2(clone(input));
      expectNoVisibleColumnCollisions(result, input);
      expectVisibleCardsPreserved(result, input);
      expectResolvableLinksAligned(result, input);
      expectResolvableConflictsSeparated(result, input);
      expectWarningsInCatalog(result);
    });
  });

  it("keeps played cards on their resolvedRow after a later transaction", () => {
    inputs.forEach((input) => {
      const first = resolveOrderAfterTransactionV2(clone(input));
      const nextInput = withPreviousLayout(input, first.layoutByCardId);
      nextInput.cards.push(
        makeCard(`${input.transactionContext.transactionId}_new`, "instrument_voice", 6),
      );
      const second = resolveOrderAfterTransactionV2(nextInput);
      const playedCardId = visibleCards(input).find((card) => card.played).cardId;
      expect(second.layoutByCardId[playedCardId].resolvedRow).toBe(
        first.layoutByCardId[playedCardId].resolvedRow,
      );
    });
  });

  it("keeps locked cards on their resolvedRow while they remain locked", () => {
    inputs.forEach((input) => {
      const first = resolveOrderAfterTransactionV2(clone(input));
      const nextInput = withPreviousLayout(input, first.layoutByCardId, {
        intent: "move",
        anchorCardId: `s${input.transactionContext.transactionId.replace("transaction_", "")}_voice_5`,
        preferredResolvedRow: 2,
      });
      const second = resolveOrderAfterTransactionV2(nextInput);
      const lockedCardId = visibleCards(input).find((card) => card.locked).cardId;
      expect(second.layoutByCardId[lockedCardId].resolvedRow).toBe(
        first.layoutByCardId[lockedCardId].resolvedRow,
      );
    });
  });

  it("ignores hidden-column constraints when computing visible card layout", () => {
    inputs.forEach((input) => {
      const withHidden = resolveOrderAfterTransactionV2(clone(input));
      const withoutHidden = resolveOrderAfterTransactionV2(stripHiddenConstraints(input));
      expect(visibleLayout(withHidden, input)).toEqual(
        visibleLayout(withoutHidden, input),
      );
    });
  });

  it("allows mixed rounds without round-first reordering", () => {
    const input = {
      cards: [
        makeCard("mixed", "instrument_voice", 1, {
          cardId: "round_2_before_round_1",
          appearanceId: "round_2_before_round_1",
          appearanceIndex: 2,
          baseOrder: 1,
          previousResolvedRow: 1,
          resolvedRow: 1,
        }),
        makeCard("mixed", "instrument_voice", 2, {
          cardId: "round_1_after_round_2",
          appearanceId: "round_1_after_round_2",
          appearanceIndex: 1,
          baseOrder: 2,
          previousResolvedRow: 2,
          resolvedRow: 2,
        }),
      ],
      links: [],
      conflicts: [],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: {
          round_2_before_round_1: { resolvedRow: 1 },
          round_1_after_round_2: { resolvedRow: 2 },
        },
      },
      transactionContext: {
        transactionId: "transaction_mixed_rounds",
        intent: "neutral",
      },
    };
    const result = resolveOrderAfterTransactionV2(input);
    expect(result.orderedCardIdsByColumnId.instrument_voice).toEqual([
      "round_2_before_round_1",
      "round_1_after_round_2",
    ]);
    expect(result.layoutByCardId.round_2_before_round_1.visualIndex).toBeLessThan(
      result.layoutByCardId.round_1_after_round_2.visualIndex,
    );
  });

  it("aligns transitive link groups and propagates pushed-card priority", () => {
    const input = {
      cards: [
        makeCard("transitive", "instrument_voice", 1, { cardId: "A" }),
        makeCard("transitive", "instrument_voice", 2, { cardId: "B" }),
        makeCard("transitive", "instrument_guitar", 1, { cardId: "D" }),
        makeCard("transitive", "instrument_guitar", 2, { cardId: "C" }),
        makeCard("transitive", "instrument_bass", 3, { cardId: "E" }),
      ],
      links: [
        { linkId: "link_B_C", targetCardIds: ["B", "C"], active: true },
        { linkId: "link_C_E", targetCardIds: ["C", "E"], active: true },
      ],
      conflicts: [],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: {
          A: { resolvedRow: 1 },
          B: { resolvedRow: 2 },
          D: { resolvedRow: 1 },
          C: { resolvedRow: 2 },
          E: { resolvedRow: 3 },
        },
      },
      transactionContext: {
        transactionId: "transaction_transitive_links",
        intent: "move",
        anchorCardId: "A",
        afterTargetCardId: "B",
        beforeTargetCardId: null,
        affectedCardIds: ["A"],
      },
    };
    const result = resolveOrderAfterTransactionV2(input);
    expect(result.layoutByCardId.B.resolvedRow).toBe(1);
    expect(result.layoutByCardId.C.resolvedRow).toBe(1);
    expect(result.layoutByCardId.E.resolvedRow).toBe(1);
    expect(result.layoutByCardId.A.resolvedRow).toBe(2);
    expect(result.layoutByCardId.D.resolvedRow).toBe(2);
  });

  it("moves a linked group as a logical block when one member is pushed", () => {
    const input = {
      cards: [
        makeCard("block", "instrument_voice", 1, { cardId: "A" }),
        makeCard("block", "instrument_voice", 2, { cardId: "B" }),
        makeCard("block", "instrument_guitar", 2, { cardId: "C" }),
        makeCard("block", "instrument_bass", 2, { cardId: "D" }),
      ],
      links: [
        { linkId: "link_B_C", targetCardIds: ["B", "C"], active: true },
        { linkId: "link_C_D", targetCardIds: ["C", "D"], active: true },
      ],
      conflicts: [],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: {
          A: { resolvedRow: 1 },
          B: { resolvedRow: 2 },
          C: { resolvedRow: 2 },
          D: { resolvedRow: 2 },
        },
      },
      transactionContext: {
        transactionId: "transaction_group_block",
        intent: "move",
        anchorCardId: "A",
        afterTargetCardId: "B",
        beforeTargetCardId: null,
        affectedCardIds: ["A"],
      },
    };
    const result = resolveOrderAfterTransactionV2(input);
    expect(result.layoutByCardId.B.resolvedRow).toBe(1);
    expect(result.layoutByCardId.C.resolvedRow).toBe(1);
    expect(result.layoutByCardId.D.resolvedRow).toBe(1);
  });

  it("warns for a fixed/fixed collision in the same column and still returns a complete layout", () => {
    const input = {
      cards: [
        makeCard("collision", "instrument_voice", 1, {
          cardId: "fixed_a",
          locked: true,
        }),
        makeCard("collision", "instrument_voice", 1, {
          cardId: "fixed_b",
          locked: true,
        }),
      ],
      links: [],
      conflicts: [],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: {
          fixed_a: { resolvedRow: 1 },
          fixed_b: { resolvedRow: 1 },
        },
      },
      transactionContext: { transactionId: "transaction_fixed_collision" },
    };
    const result = resolveOrderAfterTransactionV2(input);
    expect(result.layoutByCardId.fixed_a).toMatchObject({
      cardId: "fixed_a",
      columnId: "instrument_voice",
      resolvedRow: 1,
    });
    expect(result.layoutByCardId.fixed_b).toMatchObject({
      cardId: "fixed_b",
      columnId: "instrument_voice",
      resolvedRow: 1,
    });
    expect(normalizedWarnings(result)).toContainEqual({
      type: "column_collision_unresolvable",
      reason: "same_column_collision_with_fixed_cards",
      severity: "error",
      cardIds: ["fixed_a", "fixed_b"],
      linkIds: undefined,
      conflictIds: undefined,
      columnIds: ["instrument_voice"],
    });
  });

  it("warns when fixed linked cards are on different rows", () => {
    const input = {
      cards: [
        makeCard("link_fixed", "instrument_voice", 1, {
          cardId: "fixed_link_a",
          locked: true,
        }),
        makeCard("link_fixed", "instrument_guitar", 3, {
          cardId: "fixed_link_b",
          locked: true,
        }),
      ],
      links: [
        {
          linkId: "link_fixed_rows",
          targetCardIds: ["fixed_link_a", "fixed_link_b"],
          active: true,
        },
      ],
      conflicts: [],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: {
          fixed_link_a: { resolvedRow: 1 },
          fixed_link_b: { resolvedRow: 3 },
        },
      },
      transactionContext: { transactionId: "transaction_fixed_link_rows" },
    };
    const result = resolveOrderAfterTransactionV2(input);
    expect(normalizedWarnings(result)).toContainEqual({
      type: "link_unresolvable",
      reason: "linked_cards_fixed_on_different_rows",
      severity: "warning",
      cardIds: ["fixed_link_a", "fixed_link_b"],
      linkIds: ["link_fixed_rows"],
      conflictIds: undefined,
      columnIds: undefined,
    });
  });

  it("warns when fixed conflicted cards share a row", () => {
    const input = {
      cards: [
        makeCard("conflict_fixed", "instrument_voice", 1, {
          cardId: "fixed_conflict_a",
          locked: true,
        }),
        makeCard("conflict_fixed", "instrument_guitar", 1, {
          cardId: "fixed_conflict_b",
          locked: true,
        }),
      ],
      links: [],
      conflicts: [
        {
          conflictId: "conflict_fixed_row",
          targetCardIds: ["fixed_conflict_a", "fixed_conflict_b"],
          active: true,
        },
      ],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: {
          fixed_conflict_a: { resolvedRow: 1 },
          fixed_conflict_b: { resolvedRow: 1 },
        },
      },
      transactionContext: { transactionId: "transaction_fixed_conflict" },
    };
    const result = resolveOrderAfterTransactionV2(input);
    expect(normalizedWarnings(result)).toContainEqual({
      type: "conflict_unresolvable",
      reason: "conflicted_cards_fixed_on_same_row",
      severity: "warning",
      cardIds: ["fixed_conflict_a", "fixed_conflict_b"],
      linkIds: undefined,
      conflictIds: ["conflict_fixed_row"],
      columnIds: undefined,
    });
  });

  it("uses a deterministic alternative link target row when the preferred row is fixed-blocked", () => {
    const input = {
      cards: [
        makeCard("alt", "instrument_voice", 1, { cardId: "A" }),
        makeCard("alt", "instrument_guitar", 1, { cardId: "B" }),
        makeCard("alt", "instrument_guitar", 1, {
          cardId: "fixed_blocker",
          locked: true,
        }),
      ],
      links: [{ linkId: "link_A_B", targetCardIds: ["A", "B"], active: true }],
      conflicts: [],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: {
          A: { resolvedRow: 1 },
          B: { resolvedRow: 1 },
          fixed_blocker: { resolvedRow: 1 },
        },
      },
      transactionContext: { transactionId: "transaction_link_alternative" },
    };
    const result = resolveOrderAfterTransactionV2(input);
    expect(result.layoutByCardId.A.resolvedRow).toBe(2);
    expect(result.layoutByCardId.B.resolvedRow).toBe(2);
    expect(result.layoutByCardId.fixed_blocker.resolvedRow).toBe(1);
    expect(
      normalizedWarnings(result).some(
        (warning) =>
          warning.type === "link_unresolvable" &&
          warning.reason === "link_target_blocked_by_fixed_card",
      ),
    ).toBe(false);
  });

  it("warns when all deterministic link target alternatives are fixed-blocked", () => {
    const blockers = Array.from({ length: 202 }, (_, index) => index + 1).flatMap(
      (row) => [
        makeCard("blocked", "instrument_voice", row, {
          cardId: `voice_blocker_${row}`,
          locked: true,
        }),
        makeCard("blocked", "instrument_guitar", row, {
          cardId: `guitar_blocker_${row}`,
          locked: true,
        }),
      ],
    );
    const input = {
      cards: [
        makeCard("blocked", "instrument_voice", 1, { cardId: "A" }),
        makeCard("blocked", "instrument_guitar", 1, { cardId: "B" }),
        ...blockers,
      ],
      links: [{ linkId: "link_blocked", targetCardIds: ["A", "B"], active: true }],
      conflicts: [],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: Object.fromEntries(
          [
            ["A", { resolvedRow: 1 }],
            ["B", { resolvedRow: 1 }],
            ...blockers.map((card) => [
              card.cardId,
              { resolvedRow: card.previousResolvedRow },
            ]),
          ],
        ),
      },
      transactionContext: { transactionId: "transaction_link_blocked" },
    };
    const result = resolveOrderAfterTransactionV2(input);
    expect(result.layoutByCardId.A).toMatchObject({
      cardId: "A",
      columnId: "instrument_voice",
    });
    expect(result.layoutByCardId.B).toMatchObject({
      cardId: "B",
      columnId: "instrument_guitar",
    });
    expect(normalizedWarnings(result)).toContainEqual({
      type: "link_unresolvable",
      reason: "link_target_blocked_by_fixed_card",
      severity: "warning",
      cardIds: ["A", "B"],
      linkIds: ["link_blocked"],
      conflictIds: undefined,
      columnIds: undefined,
    });
  });

  it("does not let raw JS object or array order change final output", () => {
    inputs.forEach((input, index) => {
      const canonical = resolveOrderAfterTransactionV2(clone(input));
      const reordered = resolveOrderAfterTransactionV2(
        reorderInputObjects(input, SEEDS[index]),
      );
      expect(reordered.layoutByCardId).toEqual(canonical.layoutByCardId);
      expect(reordered.orderedCardIdsByColumnId).toEqual(
        canonical.orderedCardIdsByColumnId,
      );
      expect(reordered.visibleResolvedRows).toEqual(canonical.visibleResolvedRows);
    });
  });
});
