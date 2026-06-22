import { describe, expect, it } from "vitest";
import { ORDER_RESOLUTION_GOLDEN_FIXTURES } from "./goldenFixtures";
import { isKnownResolverWarning } from "./resolverWarnings";
import { resolveOrderAfterTransactionV2 } from "./resolveOrderAfterTransactionV2";

const REQUIRED_FIXTURE_NAMES = [
  "fixture_01_drag_simple_push",
  "fixture_02_push_link_chain",
  "fixture_03_indirect_priority_chain",
  "fixture_04_link_fixed_target",
  "fixture_05_link_fixed_impossible",
  "fixture_06_conflict_mobile_repair",
  "fixture_07_conflict_fixed_impossible",
  "fixture_08_rounds_mixed_valid",
  "fixture_09_hidden_column_ignored",
  "fixture_10_skip_delinks_only_target",
  "fixture_11_visual_index_global_not_local_rank",
  "fixture_12_same_event_log_same_projection",
  "fixture_13_link_removed_no_magic_restore",
  "fixture_14_conflict_removed_no_magic_restore",
  "fixture_15_participation_conflict_expansion",
  "fixture_16_move_missing_before_after_target",
  "fixture_17_plateau_played_empty_visual_cell",
  "fixture_18_lock_captures_current_resolved_row",
];

function collectKeys(value, keys = []) {
  if (!value || typeof value !== "object") return keys;
  Object.keys(value).forEach((key) => {
    keys.push(key);
    collectKeys(value[key], keys);
  });
  return keys;
}

describe("order resolution golden fixtures", () => {
  it("contains every documented fixture as executable data", () => {
    expect(
      ORDER_RESOLUTION_GOLDEN_FIXTURES.map((fixture) => fixture.name),
    ).toEqual(REQUIRED_FIXTURE_NAMES);
  });

  it("uses the canonical resolver output field names", () => {
    ORDER_RESOLUTION_GOLDEN_FIXTURES.forEach((fixture) => {
      expect(fixture).toHaveProperty("name");
      expect(fixture).toHaveProperty("input");
      expect(fixture).toHaveProperty("expected.layoutByCardId");
      expect(fixture).toHaveProperty("expected.projectionWarnings");
      expect(fixture).toHaveProperty("expected.orderedCardIdsByColumnId");
      expect(collectKeys(fixture)).not.toContain("resolvedPlateauIndex");
    });
  });

  it("keeps expected warning entries inside the closed resolver warning catalog", () => {
    ORDER_RESOLUTION_GOLDEN_FIXTURES.flatMap(
      (fixture) => fixture.expected.projectionWarnings,
    ).forEach((warning) => {
      expect(isKnownResolverWarning(warning.type, warning.reason)).toBe(true);
      expect(warning).toHaveProperty("severity");
      expect(warning).toHaveProperty("cardIds");
    });
  });
});

function normalizeWarnings(warnings) {
  return warnings.map(
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

describe("order resolution golden fixture outputs against the new resolver", () => {
  ORDER_RESOLUTION_GOLDEN_FIXTURES.forEach((fixture) => {
    it(`${fixture.name} matches canonical output`, () => {
      const result = resolveOrderAfterTransactionV2(fixture.input);
      expect(stripLayoutMetadata(result.layoutByCardId)).toEqual(
        fixture.expected.layoutByCardId,
      );
      expect(result.orderedCardIdsByColumnId).toEqual(
        fixture.expected.orderedCardIdsByColumnId,
      );
      expect(result.visibleResolvedRows).toEqual(
        fixture.expected.visibleResolvedRows,
      );
      expect(normalizeWarnings(result.projectionWarnings)).toEqual(
        fixture.expected.projectionWarnings,
      );
      expect(result).toHaveProperty("debug");
    });
  });
});
