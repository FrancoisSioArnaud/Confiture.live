import { describe, expect, it } from "vitest";
import {
  RESOLVER_WARNING_CATALOG,
  RESOLVER_WARNING_REASONS,
  RESOLVER_WARNING_TYPES,
  assertKnownResolverWarning,
  createResolverWarning,
  getResolverWarningDefinition,
  isKnownResolverWarning,
} from "./resolverWarnings";

const EXPECTED_WARNING_KEYS = [
  ["link_unresolvable", "linked_cards_fixed_on_different_rows", "warning"],
  ["link_unresolvable", "linked_cards_same_column", "error"],
  ["link_unresolvable", "linked_cards_in_direct_conflict", "error"],
  ["link_unresolvable", "link_target_missing", "warning"],
  ["conflict_unresolvable", "conflicted_cards_fixed_on_same_row", "warning"],
  ["conflict_unresolvable", "conflict_target_missing", "warning"],
  [
    "column_collision_unresolvable",
    "same_column_collision_with_fixed_cards",
    "error",
  ],
  ["invalid_action_replayed", "fixed_card_move_refused", "warning"],
  ["invalid_action_replayed", "lock_target_missing_row", "warning"],
  ["invalid_action_replayed", "played_target_row_mismatch", "warning"],
  ["invalid_action_replayed", "played_empty_slot_missing_target_row", "error"],
  ["missing_target", "card_target_missing", "warning"],
  ["missing_target", "move_target_missing", "warning"],
  ["resolver_max_passes_reached", "max_passes_reached", "error"],
  ["resolver_max_passes_reached", "max_repairs_per_pass_reached", "error"],
  ["resolver_cycle_detected", "layout_cycle_detected", "error"],
  ["hidden_column_constraint_ignored", "hidden_column_not_resolved", "info"],
  ["skip_unresolvable", "skip_target_blocked", "warning"],
  ["skip_unresolvable", "skip_target_missing", "warning"],
];

describe("resolverWarnings", () => {
  it("exports the closed V0 resolver warning catalog", () => {
    expect(
      RESOLVER_WARNING_CATALOG.map(({ type, reason, severity }) => [
        type,
        reason,
        severity,
      ]),
    ).toEqual(EXPECTED_WARNING_KEYS);
    expect(RESOLVER_WARNING_TYPES).toEqual([
      "link_unresolvable",
      "conflict_unresolvable",
      "column_collision_unresolvable",
      "invalid_action_replayed",
      "missing_target",
      "resolver_max_passes_reached",
      "resolver_cycle_detected",
      "hidden_column_constraint_ignored",
      "skip_unresolvable",
    ]);
    expect(RESOLVER_WARNING_REASONS).toEqual(
      EXPECTED_WARNING_KEYS.map(([, reason]) => reason),
    );
  });

  it("accepts only known warning type/reason pairs", () => {
    EXPECTED_WARNING_KEYS.forEach(([type, reason, severity]) => {
      expect(isKnownResolverWarning(type, reason)).toBe(true);
      expect(getResolverWarningDefinition(type, reason)).toMatchObject({
        type,
        reason,
        severity,
      });
      expect(assertKnownResolverWarning(type, reason)).toMatchObject({
        type,
        reason,
        severity,
      });
    });

    expect(
      isKnownResolverWarning("link_unresolvable", "layout_cycle_detected"),
    ).toBe(false);
    expect(() =>
      assertKnownResolverWarning("unknown_type", "unknown_reason"),
    ).toThrow(/Unknown resolver projection warning/);
  });

  it("builds standard projection warnings from the closed catalog", () => {
    expect(
      createResolverWarning(
        "link_unresolvable",
        "linked_cards_fixed_on_different_rows",
        {
          transactionId: "transaction_1",
          eventId: "event_1",
          cardIds: ["A_v1", "B_g1"],
          linkIds: ["link_A_B"],
          columnIds: ["guitar"],
        },
      ),
    ).toEqual({
      type: "link_unresolvable",
      severity: "warning",
      reason: "linked_cards_fixed_on_different_rows",
      transactionId: "transaction_1",
      eventId: "event_1",
      cardIds: ["A_v1", "B_g1"],
      linkIds: ["link_A_B"],
      columnIds: ["guitar"],
      message:
        "Impossible d’aligner ce link : plusieurs cards fixes sont sur des lignes différentes.",
    });
  });
});
