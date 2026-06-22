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
