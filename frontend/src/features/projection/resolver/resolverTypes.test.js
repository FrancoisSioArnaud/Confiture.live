import { describe, expect, it } from "vitest";
import { RESOLUTION_COST } from "./resolverCosts";
import { PROPAGATION_PRIORITY } from "./resolverPriorities";

describe("resolver technical contracts", () => {
  it("exports stable canonical resolution costs", () => {
    expect(RESOLUTION_COST).toEqual({
      IMPOSSIBLE: Number.POSITIVE_INFINITY,
      MOVE_PLAYED: Number.POSITIVE_INFINITY,
      MOVE_LOCKED: Number.POSITIVE_INFINITY,
      CHANGE_COLUMN: Number.POSITIVE_INFINITY,
      FINAL_COLUMN_COLLISION: Number.POSITIVE_INFINITY,
      UNRESOLVED_LINK: 100000,
      UNRESOLVED_CONFLICT: 100000,
      USER_ANCHOR_NOT_PRESERVED: 10000,
      MOVE_LINK_GROUP: 1000,
      MOVE_SECONDARY_CARD: 100,
      RELATIVE_ORDER_INVERSION: 50,
      MOVED_CARD_COUNT: 25,
      ROW_DISTANCE: 10,
      VISUAL_CHURN: 5,
      STABLE_TIEBREAKER: 1,
    });
    expect(Object.isFrozen(RESOLUTION_COST)).toBe(true);
  });

  it("exports stable canonical propagation priorities", () => {
    expect(PROPAGATION_PRIORITY).toEqual({
      USER_MOVE: 1000,
      USER_CREATED_CARD: 950,
      USER_LOCKED_CARD: 900,
      USER_LINK_STRATEGY_TARGET: 850,
      PUSHED_BY_USER_MOVE: 800,
      LINKED_TO_PUSHED_CARD: 700,
      PUSHED_BY_LINKED_CARD: 600,
      LINKED_TO_INDIRECT_PUSH: 500,
      CONFLICT_REPAIR_TARGET: 400,
      STABILITY_DEFAULT: 100,
    });
    expect(Object.isFrozen(PROPAGATION_PRIORITY)).toBe(true);
  });
});
