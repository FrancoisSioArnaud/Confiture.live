import { describe, expect, it } from "vitest";
import { applyTransactionIntent } from "./applyTransactionIntent";
import { buildActiveConflicts } from "./buildActiveConflicts";
import { buildInitialLayout } from "./buildInitialLayout";
import { buildLinkGroups } from "./buildLinkGroups";
import { buildVisibleCards } from "./buildVisibleCards";
import { compareResolverEntities } from "./compareResolverEntities";
import { ORDER_RESOLUTION_GOLDEN_FIXTURES } from "./goldenFixtures";
import { normalizeVisualIndexes } from "./normalizeVisualIndexes";
import { resolveOrderAfterTransactionV2 } from "./resolveOrderAfterTransactionV2";
import { layoutHash, runResolutionPass } from "./runResolutionPass";

function fixture(name) {
  return ORDER_RESOLUTION_GOLDEN_FIXTURES.find((item) => item.name === name);
}

function stripLayoutMetadata(layoutByCardId) {
  return Object.fromEntries(
    Object.entries(layoutByCardId).map(([cardId, layout]) => [
      cardId,
      {
        resolvedRow: layout.resolvedRow,
        visualIndex: layout.visualIndex,
        cardIndexInColumn: layout.cardIndexInColumn,
      },
    ]),
  );
}

describe("resolver V2 helpers", () => {
  it("compareResolverEntities sorts by previous row, creation order, then card id", () => {
    expect(
      [
        { cardId: "b", previousResolvedRow: 2, createdAtOrder: 1 },
        { cardId: "a", previousResolvedRow: 1, createdAtOrder: 2 },
        { cardId: "c", previousResolvedRow: 1, createdAtOrder: 1 },
      ]
        .sort(compareResolverEntities)
        .map((card) => card.cardId),
    ).toEqual(["c", "a", "b"]);
  });

  it("buildVisibleCards filters deleted and hidden-column cards deterministically", () => {
    expect(
      buildVisibleCards({
        cards: [
          { cardId: "b", columnId: "visible", baseOrder: 2 },
          { cardId: "a", columnId: "visible", baseOrder: 1 },
          { cardId: "hidden", columnId: "hidden", baseOrder: 3 },
          { cardId: "deleted", columnId: "visible", deleted: true },
        ],
        hiddenColumnIds: ["hidden"],
      }).map((card) => card.cardId),
    ).toEqual(["a", "b"]);
  });

  it("buildLinkGroups unions visible active link targets and reports visible-hidden constraints", () => {
    const result = buildLinkGroups({
      cards: [{ cardId: "a" }, { cardId: "b" }],
      links: [
        { linkId: "link_ab", active: true, targetCardIds: ["a", "b"] },
        { linkId: "link_ah", active: true, targetCardIds: ["a", "hidden"] },
      ],
      hiddenColumnIds: ["instrument_hidden"],
      transactionContext: { transactionId: "tx" },
    });
    expect(result.groups).toEqual([
      {
        cardIds: ["a", "b"],
        linkIds: ["link_ab"],
        reorderStrategy: "move_to_first",
      },
    ]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatchObject({
      type: "hidden_column_constraint_ignored",
      reason: "hidden_column_not_resolved",
    });
  });

  it("buildActiveConflicts expands participation conflicts across visible cards", () => {
    const result = buildActiveConflicts({
      cards: [
        { cardId: "a1", participationId: "pa" },
        { cardId: "a2", participationId: "pa" },
        { cardId: "b1", participationId: "pb" },
      ],
      conflicts: [
        {
          conflictId: "conflict",
          active: true,
          scope: "participation",
          targetParticipationIds: ["pa", "pb"],
        },
      ],
    });
    expect(result.conflicts[0].targetCardIds).toEqual(["a1", "a2", "b1"]);
  });

  it("buildInitialLayout seeds rows without mutating cards", () => {
    const card = { cardId: "a", columnId: "voice", baseOrder: 5, played: true };
    expect(
      buildInitialLayout({
        cards: [card],
        previousLayout: { byCardId: { a: { resolvedRow: 3 } } },
      }),
    ).toMatchObject({ a: { resolvedRow: 3, fixed: true } });
    expect(card).not.toHaveProperty("resolvedRow");
  });

  it("applyTransactionIntent applies manual move inside a column", () => {
    const layout = buildInitialLayout({
      cards: fixture("fixture_01_drag_simple_push").input.cards,
      previousLayout: fixture("fixture_01_drag_simple_push").input
        .previousLayout,
    });
    const moved = applyTransactionIntent(
      layout,
      fixture("fixture_01_drag_simple_push").input.transactionContext,
    );
    expect(normalizeVisualIndexes(moved).orderedCardIdsByColumnId).toEqual(
      fixture("fixture_01_drag_simple_push").expected.orderedCardIdsByColumnId,
    );
  });

  it("runResolutionPass aligns resolvable links and separates resolvable conflicts", () => {
    let layout = buildInitialLayout({
      cards: fixture("fixture_06_conflict_mobile_repair").input.cards,
      previousLayout: fixture("fixture_06_conflict_mobile_repair").input
        .previousLayout,
    });
    const result = runResolutionPass(layout, {
      conflicts: fixture("fixture_06_conflict_mobile_repair").input.conflicts,
      transactionContext: { transactionId: "tx" },
    });
    expect(
      result.layout[
        fixture("fixture_06_conflict_mobile_repair").input.cards[1].cardId
      ].resolvedRow,
    ).toBe(2);
    expect(layoutHash(result.layout)).not.toBe(layoutHash(layout));
  });

  it("normalizeVisualIndexes compresses visual indexes globally", () => {
    expect(
      normalizeVisualIndexes(
        buildInitialLayout({
          cards: fixture("fixture_11_visual_index_global_not_local_rank").input
            .cards,
          previousLayout: fixture(
            "fixture_11_visual_index_global_not_local_rank",
          ).input.previousLayout,
        }),
      ).visibleResolvedRows,
    ).toEqual([1, 3, 7]);
  });
});

describe("resolveOrderAfterTransactionV2", () => {
  it.each([
    "fixture_01_drag_simple_push",
    "fixture_04_link_fixed_target",
    "fixture_05_link_fixed_impossible",
    "fixture_06_conflict_mobile_repair",
    "fixture_08_rounds_mixed_valid",
    "fixture_09_hidden_column_ignored",
    "fixture_11_visual_index_global_not_local_rank",
    "fixture_13_link_removed_no_magic_restore",
    "fixture_14_conflict_removed_no_magic_restore",
  ])("matches %s", (name) => {
    const item = fixture(name);
    const result = resolveOrderAfterTransactionV2(item.input);
    expect(stripLayoutMetadata(result.layoutByCardId)).toEqual(
      item.expected.layoutByCardId,
    );
    expect(result.orderedCardIdsByColumnId).toEqual(
      item.expected.orderedCardIdsByColumnId,
    );
    expect(result.visibleResolvedRows).toEqual(
      item.expected.visibleResolvedRows,
    );
    expect(
      result.projectionWarnings.map(
        ({
          type,
          reason,
          severity,
          cardIds,
          linkIds,
          conflictIds,
          columnIds,
        }) => ({
          type,
          reason,
          severity,
          cardIds,
          linkIds,
          conflictIds,
          columnIds,
        }),
      ),
    ).toEqual(item.expected.projectionWarnings);
    expect(result.debug).toHaveProperty("passes");
  });
});
