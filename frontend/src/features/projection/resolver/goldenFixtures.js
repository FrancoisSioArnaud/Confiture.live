import { makeAppearanceId, makeCardIdFromHoleId } from "./resolverIds";

export const COLUMN_IDS = Object.freeze({
  voice: "instrument_voice",
  guitar: "instrument_guitar",
  bass: "instrument_bass",
});

const CARD_IDS = Object.freeze({
  A_v1: makeAppearanceId("participation_A_voice", 1),
  B_v1: makeAppearanceId("participation_B_voice", 1),
  C_v1: makeAppearanceId("participation_C_voice", 1),
  B_v2: makeAppearanceId("participation_B_voice", 2),
  B_g1: makeAppearanceId("participation_B_guitar", 1),
  C_g1: makeAppearanceId("participation_C_guitar", 1),
  D_g1: makeAppearanceId("participation_D_guitar", 1),
  E_g1: makeAppearanceId("participation_E_guitar", 1),
  C_b1: makeAppearanceId("participation_C_bass", 1),
  E_b1: makeAppearanceId("participation_E_bass", 1),
  P1_v1: makeAppearanceId("participation_P1", 1),
  P1_v2: makeAppearanceId("participation_P1", 2),
  P2_g1: makeAppearanceId("participation_P2", 1),
  P2_g2: makeAppearanceId("participation_P2", 2),
  H_g1: makeCardIdFromHoleId("hole_empty_guitar_1"),
});

function id(alias) {
  return CARD_IDS[alias];
}

function column(alias) {
  return COLUMN_IDS[alias];
}

function card(alias, columnAlias, baseOrder, overrides = {}) {
  const cardId = id(alias);
  return {
    cardId,
    type: "appearance",
    columnId: column(columnAlias),
    participantId: null,
    participationId: overrides.participationId ?? null,
    appearanceId: cardId,
    holeId: null,
    appearanceIndex: overrides.appearanceIndex ?? 1,
    createdAtOrder: baseOrder,
    baseOrder,
    previousResolvedRow: baseOrder,
    played: false,
    locked: false,
    deleted: false,
    hidden: false,
    ...overrides,
  };
}

function layout(
  alias,
  columnAlias,
  resolvedRow,
  visualIndex,
  cardIndexInColumn,
) {
  return {
    cardId: id(alias),
    columnId: column(columnAlias),
    resolvedRow,
    visualIndex,
    cardIndexInColumn,
  };
}

function expectedEntry(resolvedRow, visualIndex, cardIndexInColumn) {
  return { resolvedRow, visualIndex, cardIndexInColumn };
}

export const ORDER_RESOLUTION_GOLDEN_FIXTURES = Object.freeze([
  {
    name: "fixture_01_drag_simple_push",
    input: {
      cards: [
        card("A_v1", "voice", 1),
        card("B_v1", "voice", 2),
        card("C_v1", "voice", 3),
      ],
      links: [],
      conflicts: [],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: {
          [id("A_v1")]: layout("A_v1", "voice", 1, 1, 1),
          [id("B_v1")]: layout("B_v1", "voice", 2, 2, 2),
          [id("C_v1")]: layout("C_v1", "voice", 3, 3, 3),
        },
      },
      transactionContext: {
        intent: "move",
        anchorCardId: id("C_v1"),
        afterTargetCardId: id("A_v1"),
        beforeTargetCardId: id("B_v1"),
        affectedCardIds: [id("C_v1")],
      },
      config: {},
    },
    expected: {
      layoutByCardId: {
        [id("A_v1")]: expectedEntry(1, 1, 1),
        [id("C_v1")]: expectedEntry(2, 2, 2),
        [id("B_v1")]: expectedEntry(3, 3, 3),
      },
      orderedCardIdsByColumnId: {
        [column("voice")]: [id("A_v1"), id("C_v1"), id("B_v1")],
      },
      visibleResolvedRows: [1, 2, 3],
      projectionWarnings: [],
    },
  },
  {
    name: "fixture_02_push_link_chain",
    input: {
      cards: [
        card("A_v1", "voice", 1),
        card("B_v1", "voice", 2),
        card("D_g1", "guitar", 1),
        card("E_g1", "guitar", 2),
      ],
      links: [
        {
          linkId: "link_B_E",
          targetCardIds: [id("B_v1"), id("E_g1")],
          active: true,
          reorderStrategy: "move_to_first",
          createdAtOrder: 10,
        },
      ],
      conflicts: [],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: {
          [id("A_v1")]: layout("A_v1", "voice", 1, 1, 1),
          [id("B_v1")]: layout("B_v1", "voice", 2, 2, 2),
          [id("D_g1")]: layout("D_g1", "guitar", 1, 1, 1),
          [id("E_g1")]: layout("E_g1", "guitar", 2, 2, 2),
        },
      },
      transactionContext: {
        intent: "move",
        anchorCardId: id("A_v1"),
        afterTargetCardId: id("B_v1"),
        beforeTargetCardId: null,
        affectedCardIds: [id("A_v1")],
      },
      config: {},
    },
    expected: {
      layoutByCardId: {
        [id("B_v1")]: expectedEntry(1, 1, 1),
        [id("E_g1")]: expectedEntry(1, 1, 1),
        [id("A_v1")]: expectedEntry(2, 2, 2),
        [id("D_g1")]: expectedEntry(2, 2, 2),
      },
      orderedCardIdsByColumnId: {
        [column("voice")]: [id("B_v1"), id("A_v1")],
        [column("guitar")]: [id("E_g1"), id("D_g1")],
      },
      visibleResolvedRows: [1, 2],
      projectionWarnings: [],
    },
  },
  {
    name: "fixture_03_indirect_priority_chain",
    input: {
      cards: [
        card("A_v1", "voice", 1),
        card("B_v1", "voice", 2),
        card("D_g1", "guitar", 1),
        card("C_g1", "guitar", 2),
        card("E_b1", "bass", 1),
      ],
      links: [
        {
          linkId: "link_B_C",
          targetCardIds: [id("B_v1"), id("C_g1")],
          active: true,
          reorderStrategy: "move_to_first",
          createdAtOrder: 10,
        },
        {
          linkId: "link_D_E",
          targetCardIds: [id("D_g1"), id("E_b1")],
          active: true,
          reorderStrategy: "move_to_first",
          createdAtOrder: 11,
        },
      ],
      conflicts: [],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: {
          [id("A_v1")]: layout("A_v1", "voice", 1, 1, 1),
          [id("B_v1")]: layout("B_v1", "voice", 2, 2, 2),
          [id("D_g1")]: layout("D_g1", "guitar", 1, 1, 1),
          [id("C_g1")]: layout("C_g1", "guitar", 2, 2, 2),
          [id("E_b1")]: layout("E_b1", "bass", 1, 1, 1),
        },
      },
      transactionContext: {
        intent: "move",
        anchorCardId: id("A_v1"),
        afterTargetCardId: id("B_v1"),
        beforeTargetCardId: null,
        affectedCardIds: [id("A_v1")],
      },
      config: {},
    },
    expected: {
      layoutByCardId: {
        [id("B_v1")]: expectedEntry(1, 1, 1),
        [id("C_g1")]: expectedEntry(1, 1, 1),
        [id("A_v1")]: expectedEntry(2, 2, 2),
        [id("D_g1")]: expectedEntry(2, 2, 2),
        [id("E_b1")]: expectedEntry(2, 2, 1),
      },
      orderedCardIdsByColumnId: {
        [column("voice")]: [id("B_v1"), id("A_v1")],
        [column("guitar")]: [id("C_g1"), id("D_g1")],
        [column("bass")]: [id("E_b1")],
      },
      visibleResolvedRows: [1, 2],
      projectionWarnings: [],
    },
  },
  {
    name: "fixture_04_link_fixed_target",
    input: {
      cards: [
        card("A_v1", "voice", 1),
        card("B_g1", "guitar", 3, { locked: true }),
      ],
      links: [
        {
          linkId: "link_A_B",
          targetCardIds: [id("A_v1"), id("B_g1")],
          active: true,
          reorderStrategy: "move_to_first",
          createdAtOrder: 10,
        },
      ],
      conflicts: [],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: {
          [id("A_v1")]: layout("A_v1", "voice", 1, 1, 1),
          [id("B_g1")]: layout("B_g1", "guitar", 3, 2, 1),
        },
      },
      transactionContext: {
        intent: "link_created",
        anchorCardId: null,
        affectedCardIds: [id("A_v1"), id("B_g1")],
      },
      config: {},
    },
    expected: {
      layoutByCardId: {
        [id("A_v1")]: expectedEntry(3, 1, 1),
        [id("B_g1")]: expectedEntry(3, 1, 1),
      },
      orderedCardIdsByColumnId: {
        [column("voice")]: [id("A_v1")],
        [column("guitar")]: [id("B_g1")],
      },
      visibleResolvedRows: [3],
      projectionWarnings: [],
    },
  },
  {
    name: "fixture_05_link_fixed_impossible",
    input: {
      cards: [
        card("A_v1", "voice", 1, { locked: true }),
        card("B_g1", "guitar", 3, { played: true }),
      ],
      links: [
        {
          linkId: "link_A_B",
          targetCardIds: [id("A_v1"), id("B_g1")],
          active: true,
          reorderStrategy: "move_to_first",
          createdAtOrder: 10,
        },
      ],
      conflicts: [],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: {
          [id("A_v1")]: layout("A_v1", "voice", 1, 1, 1),
          [id("B_g1")]: layout("B_g1", "guitar", 3, 2, 1),
        },
      },
      transactionContext: {
        intent: "link_created",
        anchorCardId: null,
        affectedCardIds: [id("A_v1"), id("B_g1")],
      },
      config: {},
    },
    expected: {
      layoutByCardId: {
        [id("A_v1")]: expectedEntry(1, 1, 1),
        [id("B_g1")]: expectedEntry(3, 2, 1),
      },
      orderedCardIdsByColumnId: {
        [column("voice")]: [id("A_v1")],
        [column("guitar")]: [id("B_g1")],
      },
      visibleResolvedRows: [1, 3],
      projectionWarnings: [
        {
          type: "link_unresolvable",
          reason: "linked_cards_fixed_on_different_rows",
          severity: "warning",
          cardIds: [id("A_v1"), id("B_g1")],
          linkIds: ["link_A_B"],
        },
      ],
    },
  },
  {
    name: "fixture_06_conflict_mobile_repair",
    input: {
      cards: [card("A_v1", "voice", 1), card("B_g1", "guitar", 1)],
      links: [],
      conflicts: [
        {
          conflictId: "conflict_A_B",
          scope: "appearance",
          targetCardIds: [id("A_v1"), id("B_g1")],
          reason: "manual",
          active: true,
          createdAtOrder: 10,
        },
      ],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: {
          [id("A_v1")]: layout("A_v1", "voice", 1, 1, 1),
          [id("B_g1")]: layout("B_g1", "guitar", 1, 1, 1),
        },
      },
      transactionContext: {
        intent: "conflict_created",
        anchorCardId: null,
        affectedCardIds: [id("A_v1"), id("B_g1")],
      },
      config: {},
    },
    expected: {
      layoutByCardId: {
        [id("A_v1")]: expectedEntry(1, 1, 1),
        [id("B_g1")]: expectedEntry(2, 2, 1),
      },
      orderedCardIdsByColumnId: {
        [column("voice")]: [id("A_v1")],
        [column("guitar")]: [id("B_g1")],
      },
      visibleResolvedRows: [1, 2],
      projectionWarnings: [],
    },
  },
  {
    name: "fixture_07_conflict_fixed_impossible",
    input: {
      cards: [
        card("A_v1", "voice", 1, { played: true }),
        card("B_g1", "guitar", 1, { locked: true }),
      ],
      links: [],
      conflicts: [
        {
          conflictId: "conflict_A_B",
          scope: "appearance",
          targetCardIds: [id("A_v1"), id("B_g1")],
          reason: "manual",
          active: true,
          createdAtOrder: 10,
        },
      ],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: {
          [id("A_v1")]: layout("A_v1", "voice", 1, 1, 1),
          [id("B_g1")]: layout("B_g1", "guitar", 1, 1, 1),
        },
      },
      transactionContext: {
        intent: "conflict_created",
        anchorCardId: null,
        affectedCardIds: [id("A_v1"), id("B_g1")],
      },
      config: {},
    },
    expected: {
      layoutByCardId: {
        [id("A_v1")]: expectedEntry(1, 1, 1),
        [id("B_g1")]: expectedEntry(1, 1, 1),
      },
      orderedCardIdsByColumnId: {
        [column("voice")]: [id("A_v1")],
        [column("guitar")]: [id("B_g1")],
      },
      visibleResolvedRows: [1],
      projectionWarnings: [
        {
          type: "conflict_unresolvable",
          reason: "conflicted_cards_fixed_on_same_row",
          severity: "warning",
          cardIds: [id("A_v1"), id("B_g1")],
          conflictIds: ["conflict_A_B"],
        },
      ],
    },
  },
  {
    name: "fixture_08_rounds_mixed_valid",
    input: {
      cards: [
        card("A_v1", "voice", 1, { appearanceIndex: 1 }),
        card("B_v2", "voice", 2, { appearanceIndex: 2 }),
      ],
      links: [],
      conflicts: [],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: {
          [id("A_v1")]: layout("A_v1", "voice", 1, 1, 1),
          [id("B_v2")]: layout("B_v2", "voice", 2, 2, 2),
        },
      },
      transactionContext: {
        intent: "move",
        anchorCardId: id("B_v2"),
        afterTargetCardId: null,
        beforeTargetCardId: id("A_v1"),
        affectedCardIds: [id("B_v2")],
      },
      config: {},
    },
    expected: {
      layoutByCardId: {
        [id("B_v2")]: expectedEntry(1, 1, 1),
        [id("A_v1")]: expectedEntry(2, 2, 2),
      },
      orderedCardIdsByColumnId: { [column("voice")]: [id("B_v2"), id("A_v1")] },
      visibleResolvedRows: [1, 2],
      projectionWarnings: [],
    },
  },
  {
    name: "fixture_09_hidden_column_ignored",
    input: {
      cards: [
        card("A_v1", "voice", 2),
        card("B_g1", "guitar", 5, { hidden: true }),
      ],
      links: [
        {
          linkId: "link_A_B",
          targetCardIds: [id("A_v1"), id("B_g1")],
          active: true,
          reorderStrategy: "move_to_first",
          createdAtOrder: 10,
        },
      ],
      conflicts: [],
      hiddenColumnIds: [column("guitar")],
      previousLayout: {
        byCardId: {
          [id("A_v1")]: layout("A_v1", "voice", 2, 1, 1),
          [id("B_g1")]: layout("B_g1", "guitar", 5, 2, 1),
        },
      },
      transactionContext: {
        intent: "neutral",
        anchorCardId: null,
        affectedCardIds: [id("A_v1"), id("B_g1")],
      },
      config: {},
    },
    expected: {
      layoutByCardId: { [id("A_v1")]: expectedEntry(2, 1, 1) },
      orderedCardIdsByColumnId: { [column("voice")]: [id("A_v1")] },
      visibleResolvedRows: [2],
      projectionWarnings: [
        {
          type: "hidden_column_constraint_ignored",
          reason: "hidden_column_not_resolved",
          severity: "info",
          cardIds: [id("A_v1"), id("B_g1")],
          linkIds: ["link_A_B"],
          columnIds: [column("guitar")],
        },
      ],
    },
  },
  {
    name: "fixture_10_skip_delinks_only_target",
    input: {
      cards: [
        card("A_v1", "voice", 1),
        card("B_g1", "guitar", 1),
        card("C_b1", "bass", 1),
      ],
      links: [
        {
          linkId: "link_A_C_after_skip",
          targetCardIds: [id("A_v1"), id("C_b1")],
          active: true,
          reorderStrategy: "move_to_first",
          createdAtOrder: 11,
        },
      ],
      conflicts: [],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: {
          [id("A_v1")]: layout("A_v1", "voice", 1, 1, 1),
          [id("B_g1")]: layout("B_g1", "guitar", 1, 1, 1),
          [id("C_b1")]: layout("C_b1", "bass", 1, 1, 1),
        },
      },
      transactionContext: {
        intent: "skip",
        anchorCardId: id("B_g1"),
        affectedCardIds: [id("A_v1"), id("B_g1"), id("C_b1")],
        preferredResolvedRow: 2,
        metadata: { skippedAppearanceId: id("B_g1") },
      },
      config: {},
    },
    expected: {
      layoutByCardId: {
        [id("A_v1")]: expectedEntry(1, 1, 1),
        [id("C_b1")]: expectedEntry(1, 1, 1),
        [id("B_g1")]: expectedEntry(2, 2, 1),
      },
      orderedCardIdsByColumnId: {
        [column("voice")]: [id("A_v1")],
        [column("guitar")]: [id("B_g1")],
        [column("bass")]: [id("C_b1")],
      },
      visibleResolvedRows: [1, 2],
      projectionWarnings: [],
    },
  },
  {
    name: "fixture_11_visual_index_global_not_local_rank",
    input: {
      cards: [
        card("A_v1", "voice", 1),
        card("B_g1", "guitar", 7),
        card("C_b1", "bass", 3),
      ],
      links: [],
      conflicts: [],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: {
          [id("A_v1")]: layout("A_v1", "voice", 1, 1, 1),
          [id("B_g1")]: layout("B_g1", "guitar", 7, 3, 1),
          [id("C_b1")]: layout("C_b1", "bass", 3, 2, 1),
        },
      },
      transactionContext: {
        intent: "neutral",
        anchorCardId: null,
        affectedCardIds: [],
      },
      config: {},
    },
    expected: {
      layoutByCardId: {
        [id("A_v1")]: expectedEntry(1, 1, 1),
        [id("C_b1")]: expectedEntry(3, 2, 1),
        [id("B_g1")]: expectedEntry(7, 3, 1),
      },
      orderedCardIdsByColumnId: {
        [column("voice")]: [id("A_v1")],
        [column("guitar")]: [id("B_g1")],
        [column("bass")]: [id("C_b1")],
      },
      visibleResolvedRows: [1, 3, 7],
      projectionWarnings: [],
    },
  },
  {
    name: "fixture_12_same_event_log_same_projection",
    input: {
      variants: ["normal_order", "arrays_shuffled"],
      cards: [card("B_g1", "guitar", 1), card("A_v1", "voice", 1)],
      links: [
        {
          linkId: "link_A_B",
          targetCardIds: [id("B_g1"), id("A_v1")],
          active: true,
          reorderStrategy: "move_to_first",
          createdAtOrder: 10,
        },
      ],
      conflicts: [],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: {
          [id("A_v1")]: layout("A_v1", "voice", 1, 1, 1),
          [id("B_g1")]: layout("B_g1", "guitar", 1, 1, 1),
        },
      },
      transactionContext: {
        intent: "neutral",
        anchorCardId: null,
        affectedCardIds: [id("A_v1"), id("B_g1")],
      },
      config: {},
    },
    expected: {
      layoutByCardId: {
        [id("A_v1")]: expectedEntry(1, 1, 1),
        [id("B_g1")]: expectedEntry(1, 1, 1),
      },
      orderedCardIdsByColumnId: {
        [column("voice")]: [id("A_v1")],
        [column("guitar")]: [id("B_g1")],
      },
      visibleResolvedRows: [1],
      projectionWarnings: [],
    },
  },
  {
    name: "fixture_13_link_removed_no_magic_restore",
    input: {
      cards: [card("A_v1", "voice", 1), card("B_g1", "guitar", 3)],
      links: [],
      conflicts: [],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: {
          [id("A_v1")]: layout("A_v1", "voice", 1, 1, 1),
          [id("B_g1")]: layout("B_g1", "guitar", 1, 1, 1),
        },
      },
      transactionContext: {
        intent: "neutral",
        anchorCardId: null,
        affectedCardIds: [id("A_v1"), id("B_g1")],
        metadata: { removedLinkId: "link_A_B" },
      },
      config: {},
    },
    expected: {
      layoutByCardId: {
        [id("A_v1")]: expectedEntry(1, 1, 1),
        [id("B_g1")]: expectedEntry(1, 1, 1),
      },
      orderedCardIdsByColumnId: {
        [column("voice")]: [id("A_v1")],
        [column("guitar")]: [id("B_g1")],
      },
      visibleResolvedRows: [1],
      projectionWarnings: [],
    },
  },
  {
    name: "fixture_14_conflict_removed_no_magic_restore",
    input: {
      cards: [card("A_v1", "voice", 1), card("B_g1", "guitar", 1)],
      links: [],
      conflicts: [],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: {
          [id("A_v1")]: layout("A_v1", "voice", 1, 1, 1),
          [id("B_g1")]: layout("B_g1", "guitar", 2, 2, 1),
        },
      },
      transactionContext: {
        intent: "neutral",
        anchorCardId: null,
        affectedCardIds: [id("A_v1"), id("B_g1")],
        metadata: { removedConflictId: "conflict_A_B" },
      },
      config: {},
    },
    expected: {
      layoutByCardId: {
        [id("A_v1")]: expectedEntry(1, 1, 1),
        [id("B_g1")]: expectedEntry(2, 2, 1),
      },
      orderedCardIdsByColumnId: {
        [column("voice")]: [id("A_v1")],
        [column("guitar")]: [id("B_g1")],
      },
      visibleResolvedRows: [1, 2],
      projectionWarnings: [],
    },
  },
  {
    name: "fixture_15_participation_conflict_expansion",
    input: {
      cards: [
        card("P1_v1", "voice", 1, {
          participationId: "participation_P1",
          appearanceIndex: 1,
        }),
        card("P1_v2", "voice", 2, {
          participationId: "participation_P1",
          appearanceIndex: 2,
        }),
        card("P2_g1", "guitar", 1, {
          participationId: "participation_P2",
          appearanceIndex: 1,
        }),
        card("P2_g2", "guitar", 2, {
          participationId: "participation_P2",
          appearanceIndex: 2,
        }),
      ],
      links: [],
      conflicts: [
        {
          conflictId: "conflict_P1_P2",
          scope: "participation",
          targetParticipationIds: ["participation_P1", "participation_P2"],
          reason: "instrument_constraint",
          active: true,
          createdAtOrder: 10,
        },
      ],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: {
          [id("P1_v1")]: layout("P1_v1", "voice", 1, 1, 1),
          [id("P1_v2")]: layout("P1_v2", "voice", 2, 2, 2),
          [id("P2_g1")]: layout("P2_g1", "guitar", 1, 1, 1),
          [id("P2_g2")]: layout("P2_g2", "guitar", 2, 2, 2),
        },
      },
      transactionContext: {
        intent: "conflict_created",
        anchorCardId: null,
        affectedCardIds: [id("P1_v1"), id("P1_v2"), id("P2_g1"), id("P2_g2")],
        metadata: {
          expandedConflictPairs: [
            [id("P1_v1"), id("P2_g1")],
            [id("P1_v1"), id("P2_g2")],
            [id("P1_v2"), id("P2_g1")],
            [id("P1_v2"), id("P2_g2")],
          ],
        },
      },
      config: {},
    },
    expected: {
      layoutByCardId: {
        [id("P1_v1")]: expectedEntry(1, 1, 1),
        [id("P1_v2")]: expectedEntry(2, 2, 2),
        [id("P2_g1")]: expectedEntry(3, 3, 1),
        [id("P2_g2")]: expectedEntry(4, 4, 2),
      },
      orderedCardIdsByColumnId: {
        [column("voice")]: [id("P1_v1"), id("P1_v2")],
        [column("guitar")]: [id("P2_g1"), id("P2_g2")],
      },
      visibleResolvedRows: [1, 2, 3, 4],
      projectionWarnings: [],
    },
  },

  {
    name: "fixture_16_move_missing_before_after_target",
    input: {
      cards: [card("A_v1", "voice", 1), card("B_v1", "voice", 2)],
      links: [],
      conflicts: [],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: {
          [id("A_v1")]: layout("A_v1", "voice", 1, 1, 1),
          [id("B_v1")]: layout("B_v1", "voice", 2, 2, 2),
        },
      },
      transactionContext: {
        intent: "move",
        anchorCardId: id("A_v1"),
        afterTargetCardId: "missing_after",
        beforeTargetCardId: "missing_before",
        affectedCardIds: [id("A_v1")],
      },
      config: {},
    },
    expected: {
      layoutByCardId: {
        [id("A_v1")]: expectedEntry(1, 1, 1),
        [id("B_v1")]: expectedEntry(2, 2, 2),
      },
      orderedCardIdsByColumnId: { [column("voice")]: [id("A_v1"), id("B_v1")] },
      visibleResolvedRows: [1, 2],
      projectionWarnings: [
        {
          type: "missing_target",
          reason: "move_target_missing",
          severity: "warning",
          cardIds: ["missing_after"],
        },
        {
          type: "missing_target",
          reason: "move_target_missing",
          severity: "warning",
          cardIds: ["missing_before"],
        },
      ],
    },
  },
  {
    name: "fixture_17_plateau_played_empty_visual_cell",
    input: {
      cards: [
        card("A_v1", "voice", 1, { played: true }),
        {
          cardId: id("H_g1"),
          type: "hole",
          columnId: column("guitar"),
          participantId: null,
          participationId: null,
          appearanceId: null,
          holeId: id("H_g1"),
          appearanceIndex: null,
          createdAtOrder: 2,
          baseOrder: 1,
          previousResolvedRow: 1,
          played: true,
          locked: false,
          deleted: false,
          hidden: false,
        },
      ],
      links: [],
      conflicts: [],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: {
          [id("A_v1")]: layout("A_v1", "voice", 1, 1, 1),
          [id("H_g1")]: {
            cardId: id("H_g1"),
            columnId: column("guitar"),
            resolvedRow: 1,
            visualIndex: 1,
            cardIndexInColumn: 1,
          },
        },
      },
      transactionContext: {
        intent: "play",
        anchorCardId: null,
        affectedCardIds: [id("A_v1"), id("H_g1")],
        playedResolvedRow: 1,
        metadata: { visualIndex: 1 },
      },
      config: {},
    },
    expected: {
      layoutByCardId: {
        [id("A_v1")]: expectedEntry(1, 1, 1),
        [id("H_g1")]: expectedEntry(1, 1, 1),
      },
      orderedCardIdsByColumnId: {
        [column("voice")]: [id("A_v1")],
        [column("guitar")]: [id("H_g1")],
      },
      visibleResolvedRows: [1],
      projectionWarnings: [],
    },
  },
  {
    name: "fixture_18_lock_captures_current_resolved_row",
    input: {
      cards: [
        card("A_v1", "voice", 1, { locked: true, previousResolvedRow: 4 }),
      ],
      links: [],
      conflicts: [],
      hiddenColumnIds: [],
      previousLayout: {
        byCardId: { [id("A_v1")]: layout("A_v1", "voice", 4, 1, 1) },
      },
      transactionContext: {
        intent: "lock",
        anchorCardId: id("A_v1"),
        affectedCardIds: [id("A_v1")],
        preferredResolvedRow: 4,
      },
      config: {},
    },
    expected: {
      layoutByCardId: { [id("A_v1")]: expectedEntry(4, 1, 1) },
      orderedCardIdsByColumnId: { [column("voice")]: [id("A_v1")] },
      visibleResolvedRows: [4],
      projectionWarnings: [],
    },
  },
]);

export { CARD_IDS as GOLDEN_FIXTURE_CARD_IDS };
