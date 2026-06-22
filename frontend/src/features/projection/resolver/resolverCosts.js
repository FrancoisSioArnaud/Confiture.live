/**
 * Canonical scoring constants for the V0 order resolver.
 *
 * Values come from docs/order-resolution-hierarchy-spec.md section 4.6.
 * They are exported separately so the future resolver and tests can share a
 * single stable contract without integrating the new algorithm yet.
 */
export const RESOLUTION_COST = Object.freeze({
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
