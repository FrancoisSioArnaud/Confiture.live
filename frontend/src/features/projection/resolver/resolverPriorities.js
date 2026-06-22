/**
 * Canonical propagation priorities for the V0 order resolver.
 *
 * Values come from docs/order-resolution-hierarchy-spec.md section 4.7.
 */
export const PROPAGATION_PRIORITY = Object.freeze({
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
