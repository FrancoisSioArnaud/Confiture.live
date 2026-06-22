/**
 * @typedef {import('./resolverTypes').ProjectionWarning} ProjectionWarning
 */

export const RESOLVER_WARNING_CATALOG = Object.freeze([
  Object.freeze({
    type: "link_unresolvable",
    reason: "linked_cards_fixed_on_different_rows",
    severity: "warning",
    fatal: false,
    continueRepairs: true,
    message:
      "Impossible d’aligner ce link : plusieurs cards fixes sont sur des lignes différentes.",
  }),
  Object.freeze({
    type: "link_unresolvable",
    reason: "linked_cards_same_column",
    severity: "error",
    fatal: false,
    continueRepairs: true,
    message: "Impossible de lier deux cards de la même colonne.",
  }),
  Object.freeze({
    type: "link_unresolvable",
    reason: "linked_cards_in_direct_conflict",
    severity: "error",
    fatal: false,
    continueRepairs: true,
    message: "Impossible de lier deux cards déjà en conflict.",
  }),
  Object.freeze({
    type: "link_unresolvable",
    reason: "link_target_missing",
    severity: "warning",
    fatal: false,
    continueRepairs: true,
    message: "Un link cible une card absente.",
  }),
  Object.freeze({
    type: "conflict_unresolvable",
    reason: "conflicted_cards_fixed_on_same_row",
    severity: "warning",
    fatal: false,
    continueRepairs: true,
    message: "Impossible de séparer ce conflict : les deux cards sont fixes.",
  }),
  Object.freeze({
    type: "conflict_unresolvable",
    reason: "conflict_target_missing",
    severity: "warning",
    fatal: false,
    continueRepairs: true,
    message: "Un conflict cible une card absente.",
  }),
  Object.freeze({
    type: "column_collision_unresolvable",
    reason: "same_column_collision_with_fixed_cards",
    severity: "error",
    fatal: false,
    continueRepairs: true,
    message: "Collision insoluble dans une colonne.",
  }),
  Object.freeze({
    type: "invalid_action_replayed",
    reason: "fixed_card_move_refused",
    severity: "warning",
    fatal: false,
    continueRepairs: true,
    message:
      "Une ancienne action voulait déplacer une card fixe ; elle a été ignorée.",
  }),
  Object.freeze({
    type: "invalid_action_replayed",
    reason: "lock_target_missing_row",
    severity: "warning",
    fatal: false,
    continueRepairs: true,
    message: "Impossible de rejouer ce lock : aucune row courante disponible.",
  }),
  Object.freeze({
    type: "invalid_action_replayed",
    reason: "played_target_row_mismatch",
    severity: "warning",
    fatal: false,
    continueRepairs: true,
    message:
      "Une target jouée n’était plus sur la row attendue ; elle reste figée sur sa row courante.",
  }),
  Object.freeze({
    type: "invalid_action_replayed",
    reason: "played_empty_slot_missing_target_row",
    severity: "error",
    fatal: false,
    continueRepairs: true,
    message: "Hole de plateau joué invalide : targetResolvedRow manquant.",
  }),
  Object.freeze({
    type: "missing_target",
    reason: "card_target_missing",
    severity: "warning",
    fatal: false,
    continueRepairs: true,
    message: "Une target de transaction est absente.",
  }),
  Object.freeze({
    type: "missing_target",
    reason: "move_target_missing",
    severity: "warning",
    fatal: false,
    continueRepairs: true,
    message: "Une borne de move est absente ; fallback stable appliqué.",
  }),
  Object.freeze({
    type: "resolver_max_passes_reached",
    reason: "max_passes_reached",
    severity: "error",
    fatal: true,
    continueRepairs: false,
    message: "Le resolver a atteint sa limite de passes.",
  }),
  Object.freeze({
    type: "resolver_max_passes_reached",
    reason: "max_repairs_per_pass_reached",
    severity: "error",
    fatal: true,
    continueRepairs: false,
    message: "Le resolver a atteint sa limite de réparations.",
  }),
  Object.freeze({
    type: "resolver_cycle_detected",
    reason: "layout_cycle_detected",
    severity: "error",
    fatal: true,
    continueRepairs: false,
    message: "Oscillation détectée dans le resolver.",
  }),
  Object.freeze({
    type: "hidden_column_constraint_ignored",
    reason: "hidden_column_not_resolved",
    severity: "info",
    fatal: false,
    continueRepairs: true,
    message: "Une contrainte liée à une colonne masquée a été ignorée.",
  }),
  Object.freeze({
    type: "skip_unresolvable",
    reason: "skip_target_blocked",
    severity: "warning",
    fatal: false,
    continueRepairs: true,
    message:
      "Impossible de repousser cette appearance sans casser une contrainte dure.",
  }),
  Object.freeze({
    type: "skip_unresolvable",
    reason: "skip_target_missing",
    severity: "warning",
    fatal: false,
    continueRepairs: true,
    message: "L’appearance à repousser est absente.",
  }),
]);

export const RESOLVER_WARNING_TYPES = Object.freeze([
  ...new Set(RESOLVER_WARNING_CATALOG.map((entry) => entry.type)),
]);
export const RESOLVER_WARNING_REASONS = Object.freeze([
  ...new Set(RESOLVER_WARNING_CATALOG.map((entry) => entry.reason)),
]);

const catalogByKey = new Map(
  RESOLVER_WARNING_CATALOG.map((entry) => [
    warningKey(entry.type, entry.reason),
    entry,
  ]),
);

/**
 * @param {string} type
 * @param {string} reason
 * @returns {string}
 */
function warningKey(type, reason) {
  return `${type}:${reason}`;
}

/**
 * Return the closed-catalog definition for a warning type/reason pair.
 *
 * @param {string} type
 * @param {string} reason
 * @returns {{type: string, reason: string, severity: 'info'|'warning'|'error', fatal: boolean, continueRepairs: boolean, message: string}|null}
 */
export function getResolverWarningDefinition(type, reason) {
  return catalogByKey.get(warningKey(type, reason)) ?? null;
}

/**
 * @param {string} type
 * @param {string} reason
 * @returns {boolean}
 */
export function isKnownResolverWarning(type, reason) {
  return Boolean(getResolverWarningDefinition(type, reason));
}

/**
 * Throws when a warning does not belong to the closed V0 catalog.
 *
 * @param {string} type
 * @param {string} reason
 * @returns {{type: string, reason: string, severity: 'info'|'warning'|'error', fatal: boolean, continueRepairs: boolean, message: string}}
 */
export function assertKnownResolverWarning(type, reason) {
  const definition = getResolverWarningDefinition(type, reason);
  if (!definition)
    throw new Error(`Unknown resolver projection warning: ${type}:${reason}`);
  return definition;
}

/**
 * Build a standard projection warning from the closed V0 catalog.
 *
 * @param {string} type
 * @param {string} reason
 * @param {{transactionId?: string, eventId?: string, cardIds?: string[], linkIds?: string[], conflictIds?: string[], columnIds?: string[], message?: string}} [details]
 * @returns {ProjectionWarning}
 */
export function createResolverWarning(type, reason, details = {}) {
  const definition = assertKnownResolverWarning(type, reason);
  return {
    type: definition.type,
    severity: definition.severity,
    reason: definition.reason,
    transactionId: details.transactionId ?? "",
    ...(details.eventId ? { eventId: details.eventId } : {}),
    cardIds: [...(details.cardIds ?? [])],
    ...(details.linkIds ? { linkIds: [...details.linkIds] } : {}),
    ...(details.conflictIds ? { conflictIds: [...details.conflictIds] } : {}),
    ...(details.columnIds ? { columnIds: [...details.columnIds] } : {}),
    message: details.message ?? definition.message,
  };
}
