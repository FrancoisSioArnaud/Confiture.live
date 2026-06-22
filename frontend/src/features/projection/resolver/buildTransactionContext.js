import {
  ALLOWED_EVENT_TYPES,
  EVENT_TYPES,
} from "../../../shared/constants/eventTypes";
import { makeAppearanceId } from "./resolverIds";

const INTENT_PRIORITY = Object.freeze({
  move: 90,
  skip: 80,
  link_created: 70,
  conflict_created: 60,
  card_created: 50,
  lock: 40,
  unlock: 40,
  play: 30,
  unplay: 30,
  visibility_changed: 20,
  neutral: 10,
});

const EMPTY_CONTEXT_FIELDS = Object.freeze({
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
  possibleWarnings: [],
  metadata: {},
});

function targetToCardId(target) {
  if (!target) return null;
  if (typeof target === "string") return target;
  return (
    target.id ?? target.cardId ?? target.appearanceId ?? target.holeId ?? null
  );
}

function compact(values) {
  return values.filter(
    (value) => value !== null && value !== undefined && value !== "",
  );
}

function unique(values) {
  return [...new Set(compact(values))];
}

function previousLayoutEntry(state, cardId) {
  return (
    state?.previousLayout?.byCardId?.[cardId] ??
    state?.resolverLayout?.byCardId?.[cardId] ??
    state?.layoutByCardId?.[cardId] ??
    null
  );
}

function previousResolvedRow(state, cardId) {
  return previousLayoutEntry(state, cardId)?.resolvedRow ?? null;
}

function cardsForColumn(state, columnId) {
  return [
    ...Object.values(state?.appearances ?? {}),
    ...Object.values(state?.holes ?? {}),
  ]
    .filter((card) => (card.columnId ?? card.instrumentId) === columnId)
    .map((card) => card.cardId ?? card.appearanceId ?? card.holeId ?? card.id);
}

function futureCardsForParticipant(state, participantId) {
  return Object.values(state?.appearances ?? {})
    .filter(
      (appearance) =>
        appearance.participantId === participantId && !appearance.played,
    )
    .map(
      (appearance) =>
        appearance.cardId ?? appearance.appearanceId ?? appearance.id,
    );
}

function cardsForParticipation(state, participationId) {
  return Object.values(state?.appearances ?? {})
    .filter((appearance) => appearance.participationId === participationId)
    .map(
      (appearance) =>
        appearance.cardId ?? appearance.appearanceId ?? appearance.id,
    );
}

function context(overrides = {}) {
  return {
    ...EMPTY_CONTEXT_FIELDS,
    ...overrides,
    affectedCardIds: unique(
      overrides.affectedCardIds ?? EMPTY_CONTEXT_FIELDS.affectedCardIds,
    ),
    removedLinkIds: unique(
      overrides.removedLinkIds ?? EMPTY_CONTEXT_FIELDS.removedLinkIds,
    ),
    validationHints: unique(
      overrides.validationHints ?? EMPTY_CONTEXT_FIELDS.validationHints,
    ),
    possibleWarnings: unique(
      overrides.possibleWarnings ?? EMPTY_CONTEXT_FIELDS.possibleWarnings,
    ),
    metadata: { ...(overrides.metadata ?? {}) },
  };
}

function neutral(overrides = {}) {
  return context({ intent: "neutral", ...overrides });
}

function firstVisibleAppearanceId(payload) {
  const explicit =
    payload.createdAppearanceIds?.[0] ??
    payload.appearanceIds?.[0] ??
    payload.appearanceId;
  if (explicit) return explicit;
  if (payload.participationId && Number.isInteger(payload.startAppearanceIndex))
    return makeAppearanceId(
      payload.participationId,
      payload.startAppearanceIndex,
    );
  if (payload.participationId)
    return makeAppearanceId(payload.participationId, 1);
  return null;
}

function createdAppearanceIds(payload) {
  if (Array.isArray(payload.createdAppearanceIds))
    return payload.createdAppearanceIds;
  if (Array.isArray(payload.appearanceIds)) return payload.appearanceIds;
  return compact([firstVisibleAppearanceId(payload)]);
}

const EVENT_CONTEXT_BUILDERS = Object.freeze({
  [EVENT_TYPES.JAM_CREATED]: (_state, event) =>
    neutral({
      metadata: { jamId: event.payload?.jamId },
      validationHints: ["jam_created_initializes_projection"],
    }),
  [EVENT_TYPES.JAM_UPDATED]: (_state, event) =>
    neutral({
      metadata: { jamId: event.payload?.jamId },
      validationHints: ["jam_update_does_not_reorder_cards"],
    }),
  [EVENT_TYPES.INSTRUMENT_ADDED]: (_state, event) =>
    neutral({
      metadata: { columnId: event.payload?.instrumentId },
      validationHints: ["instrument_added_does_not_create_cards"],
    }),
  [EVENT_TYPES.INSTRUMENT_UPDATED]: (_state, event) =>
    neutral({
      metadata: { columnId: event.payload?.instrumentId },
      validationHints: ["instrument_update_does_not_reorder_cards"],
    }),
  [EVENT_TYPES.INSTRUMENTS_REORDERED]: (_state, event) =>
    neutral({
      metadata: { orderedColumnIds: event.payload?.orderedInstrumentIds ?? [] },
      validationHints: ["instrument_reorder_does_not_change_resolved_rows"],
    }),
  [EVENT_TYPES.INSTRUMENT_VISIBILITY_CHANGED]: (state, event) => {
    const columnId = event.payload?.instrumentId;
    const hidden = event.payload?.visible === false;
    return context({
      intent: "visibility_changed",
      affectedCardIds: cardsForColumn(state, columnId),
      metadata: { columnId, hidden },
      validationHints: ["confirm_active_links_when_hiding_column"],
      possibleWarnings: [
        "hidden_column_constraint_ignored:hidden_column_not_resolved",
      ],
    });
  },
  [EVENT_TYPES.JAM_LINK_REORDER_STRATEGY_CHANGED]: (_state, event) =>
    neutral({
      metadata: {
        newStrategy: event.payload?.nextStrategy ?? event.payload?.newStrategy,
      },
      validationHints: ["existing_links_keep_event_strategy"],
    }),
  [EVENT_TYPES.PARTICIPANT_CREATED]: (_state, event) =>
    neutral({
      metadata: { participantId: event.payload?.participantId },
      validationHints: ["participant_created_does_not_create_cards"],
    }),
  [EVENT_TYPES.PARTICIPANT_UPDATED]: (_state, event) =>
    neutral({
      metadata: { participantId: event.payload?.participantId },
      validationHints: ["participant_update_does_not_reorder_cards"],
    }),
  [EVENT_TYPES.PARTICIPANT_REMOVED]: (state, event) =>
    context({
      intent: "visibility_changed",
      affectedCardIds: futureCardsForParticipant(
        state,
        event.payload?.participantId,
      ),
      metadata: {
        participantId: event.payload?.participantId,
        removedFutureCardIds: futureCardsForParticipant(
          state,
          event.payload?.participantId,
        ),
      },
      validationHints: [
        "confirm_if_removed_participant_has_links_or_played_cards",
      ],
      possibleWarnings: [
        "link_unresolvable:link_target_missing",
        "conflict_unresolvable:conflict_target_missing",
      ],
    }),
  [EVENT_TYPES.PARTICIPANT_MARKED_LEFT]: (state, event) =>
    context({
      intent: "visibility_changed",
      affectedCardIds: futureCardsForParticipant(
        state,
        event.payload?.participantId,
      ),
      metadata: {
        participantId: event.payload?.participantId,
        removedFutureCardIds: futureCardsForParticipant(
          state,
          event.payload?.participantId,
        ),
      },
      validationHints: ["confirm_if_future_linked_appearances_are_removed"],
      possibleWarnings: [
        "link_unresolvable:link_target_missing",
        "conflict_unresolvable:conflict_target_missing",
      ],
    }),
  [EVENT_TYPES.PARTICIPATION_ADDED]: (_state, event) => {
    const affectedCardIds = createdAppearanceIds(event.payload ?? {});
    return context({
      intent: "card_created",
      anchorCardId: affectedCardIds[0] ?? null,
      affectedCardIds,
      metadata: {
        createdParticipationId: event.payload?.participationId,
        createdAppearanceIds: affectedCardIds,
        seedMode: "end_of_visible_rounds",
      },
      validationHints: ["instrument_must_exist_and_be_visible"],
      possibleWarnings: [
        "column_collision_unresolvable:same_column_collision_with_fixed_cards",
      ],
    });
  },
  [EVENT_TYPES.PARTICIPATION_REMOVED]: (state, event) => {
    const removedCardIds =
      event.payload?.removedCardIds ??
      cardsForParticipation(state, event.payload?.participationId);
    return context({
      intent: "visibility_changed",
      affectedCardIds: removedCardIds,
      metadata: {
        participationId: event.payload?.participationId,
        removedCardIds,
      },
      validationHints: ["confirm_if_participation_has_links_or_played_cards"],
      possibleWarnings: [
        "link_unresolvable:link_target_missing",
        "conflict_unresolvable:conflict_target_missing",
      ],
    });
  },
  [EVENT_TYPES.APPEARANCE_MATERIALIZED]: (_state, event) =>
    context({
      intent: "card_created",
      anchorCardId: event.payload?.appearanceId ?? null,
      affectedCardIds: compact([event.payload?.appearanceId]),
      metadata: {
        materializedAppearanceId: event.payload?.appearanceId,
        seedMode: "end_of_visible_rounds",
      },
      possibleWarnings: [
        "column_collision_unresolvable:same_column_collision_with_fixed_cards",
      ],
    }),
  [EVENT_TYPES.APPEARANCE_MOVED_BETWEEN]: (_state, event) => {
    const anchorCardId = event.payload?.appearanceId ?? null;
    const afterTargetCardId = targetToCardId(event.payload?.afterTarget);
    const beforeTargetCardId = targetToCardId(event.payload?.beforeTarget);
    return context({
      intent: "move",
      anchorCardId,
      affectedCardIds: [anchorCardId, afterTargetCardId, beforeTargetCardId],
      afterTargetCardId,
      beforeTargetCardId,
      validationHints: [
        "refuse_move_if_target_played_or_locked",
        "move_bounds_must_be_in_same_column_when_present",
      ],
      possibleWarnings: [
        "missing_target:move_target_missing",
        "invalid_action_replayed:fixed_card_move_refused",
      ],
    });
  },
  [EVENT_TYPES.APPEARANCE_REMOVED]: (_state, event) =>
    context({
      intent: "visibility_changed",
      affectedCardIds: compact([event.payload?.appearanceId]),
      metadata: { removedCardIds: compact([event.payload?.appearanceId]) },
      validationHints: ["refuse_if_played", "confirm_if_linked"],
      possibleWarnings: [
        "link_unresolvable:link_target_missing",
        "conflict_unresolvable:conflict_target_missing",
      ],
    }),
  [EVENT_TYPES.APPEARANCE_LOCKED]: (state, event) => {
    const anchorCardId = event.payload?.appearanceId ?? null;
    return context({
      intent: "lock",
      anchorCardId,
      affectedCardIds: [anchorCardId],
      preferredResolvedRow:
        event.payload?.preferredResolvedRow ?? previousResolvedRow(state, anchorCardId),
      validationHints: ["lock_requires_current_resolved_row"],
      possibleWarnings: ["invalid_action_replayed:lock_target_missing_row"],
    });
  },
  [EVENT_TYPES.APPEARANCE_UNLOCKED]: (_state, event) =>
    context({
      intent: "unlock",
      anchorCardId: event.payload?.appearanceId ?? null,
      affectedCardIds: [event.payload?.appearanceId],
      validationHints: ["target_must_exist"],
      possibleWarnings: ["missing_target:card_target_missing"],
    }),
  [EVENT_TYPES.APPEARANCE_SKIPPED]: (state, event) => {
    const skippedCardId = event.payload?.appearanceId ?? null;
    const replacementCardId =
      event.payload?.replacementCardId ??
      targetToCardId(event.payload?.replacement) ??
      event.payload?.createdHoleId ??
      null;
    const skippedResolvedRow =
      event.payload?.preferredResolvedRow ??
      event.payload?.targetResolvedRow ??
      previousResolvedRow(state, skippedCardId);
    return context({
      intent: "skip",
      anchorCardId: skippedCardId,
      affectedCardIds: [
        skippedCardId,
        replacementCardId,
        event.payload?.createdHoleId,
      ],
      preferredResolvedRow: skippedResolvedRow,
      skippedCardId,
      removedLinkIds: event.payload?.removedLinkIds ?? [],
      metadata: {
        skippedAppearanceId: skippedCardId,
        skippedResolvedRow,
        replacementCardId,
        createdHoleId: event.payload?.createdHoleId ?? null,
        // Legacy replay-only hint. It must not become canonical ordering truth.
        legacyOriginalPlateauIndex: event.payload?.originalPlateauIndex,
      },
      validationHints: ["refuse_skip_if_target_played_or_locked"],
      possibleWarnings: [
        "skip_unresolvable:skip_target_blocked",
        "skip_unresolvable:skip_target_missing",
        "missing_target:card_target_missing",
      ],
    });
  },
  [EVENT_TYPES.HOLE_ADDED]: (_state, event) => {
    const createdHoleId = event.payload?.holeId ?? null;
    return context({
      intent: "card_created",
      anchorCardId: createdHoleId,
      affectedCardIds: [createdHoleId],
      preferredResolvedRow:
        event.payload?.preferredResolvedRow ??
        event.payload?.targetResolvedRow ??
        null,
      playedResolvedRow:
        event.payload?.reason === "played_empty_slot"
          ? (event.payload?.targetResolvedRow ?? null)
          : null,
      createdHoleId,
      metadata: {
        reason: event.payload?.reason,
        preferredResolvedRow: event.payload?.preferredResolvedRow ?? null,
        targetResolvedRow: event.payload?.targetResolvedRow ?? null,
      },
      validationHints: ["targetResolvedRow_required_for_played_empty_slot"],
      possibleWarnings: [
        "invalid_action_replayed:played_empty_slot_missing_target_row",
        "column_collision_unresolvable:same_column_collision_with_fixed_cards",
      ],
    });
  },
  [EVENT_TYPES.HOLE_REMOVED]: (_state, event) =>
    context({
      intent: "visibility_changed",
      affectedCardIds: [event.payload?.holeId],
      metadata: { removedCardIds: compact([event.payload?.holeId]) },
      validationHints: ["refuse_if_played", "confirm_if_linked"],
      possibleWarnings: [
        "link_unresolvable:link_target_missing",
        "conflict_unresolvable:conflict_target_missing",
      ],
    }),
  [EVENT_TYPES.HOLE_MOVED_BETWEEN]: (_state, event) => {
    const anchorCardId = event.payload?.holeId ?? null;
    const afterTargetCardId = targetToCardId(event.payload?.afterTarget);
    const beforeTargetCardId = targetToCardId(event.payload?.beforeTarget);
    return context({
      intent: "move",
      anchorCardId,
      affectedCardIds: [anchorCardId, afterTargetCardId, beforeTargetCardId],
      afterTargetCardId,
      beforeTargetCardId,
      validationHints: [
        "refuse_move_if_target_played_or_locked",
        "move_bounds_must_be_in_same_column_when_present",
      ],
      possibleWarnings: [
        "missing_target:move_target_missing",
        "invalid_action_replayed:fixed_card_move_refused",
      ],
    });
  },
  [EVENT_TYPES.HOLE_LOCKED]: (state, event) => {
    const anchorCardId = event.payload?.holeId ?? null;
    return context({
      intent: "lock",
      anchorCardId,
      affectedCardIds: [anchorCardId],
      preferredResolvedRow:
        event.payload?.preferredResolvedRow ?? previousResolvedRow(state, anchorCardId),
      validationHints: ["lock_requires_current_resolved_row"],
      possibleWarnings: ["invalid_action_replayed:lock_target_missing_row"],
    });
  },
  [EVENT_TYPES.HOLE_UNLOCKED]: (_state, event) =>
    context({
      intent: "unlock",
      anchorCardId: event.payload?.holeId ?? null,
      affectedCardIds: [event.payload?.holeId],
      validationHints: ["target_must_exist"],
      possibleWarnings: ["missing_target:card_target_missing"],
    }),
  [EVENT_TYPES.LINK_CREATED]: (_state, event) =>
    context({
      intent: "link_created",
      affectedCardIds:
        event.payload?.targetCardIds ??
        (event.payload?.targets ?? []).map(targetToCardId),
      metadata: {
        linkId: event.payload?.linkId,
        targetCardIds:
          event.payload?.targetCardIds ??
          (event.payload?.targets ?? []).map(targetToCardId),
        linkStrategy:
          event.payload?.reorderStrategy ?? event.payload?.linkStrategy ?? null,
      },
      validationHints: [
        "refuse_link_targets_same_column",
        "refuse_link_targets_direct_conflict",
      ],
      possibleWarnings: [
        "link_unresolvable:linked_cards_fixed_on_different_rows",
        "link_unresolvable:linked_cards_same_column",
        "link_unresolvable:linked_cards_in_direct_conflict",
        "link_unresolvable:link_target_missing",
      ],
    }),
  [EVENT_TYPES.LINK_REMOVED]: (_state, event) =>
    context({
      intent: "neutral",
      affectedCardIds:
        event.payload?.targetCardIds ??
        (event.payload?.targets ?? []).map(targetToCardId),
      removedLinkIds: [event.payload?.linkId],
      metadata: {
        linkId: event.payload?.linkId,
        targetCardIds:
          event.payload?.targetCardIds ??
          (event.payload?.targets ?? []).map(targetToCardId),
      },
      validationHints: ["link_must_exist_if_removing"],
      possibleWarnings: ["link_unresolvable:link_target_missing"],
    }),
  [EVENT_TYPES.CONFLICT_CREATED]: (_state, event) =>
    context({
      intent: "conflict_created",
      affectedCardIds:
        event.payload?.targetCardIds ?? event.payload?.targetIds ?? [],
      metadata: {
        conflictId: event.payload?.conflictId,
        scope: event.payload?.scope,
        reason: event.payload?.reason,
        targetParticipationIds: event.payload?.targetParticipationIds ?? [],
      },
      validationHints: ["refuse_conflict_targets_same_link_group"],
      possibleWarnings: [
        "conflict_unresolvable:conflicted_cards_fixed_on_same_row",
        "conflict_unresolvable:conflict_target_missing",
      ],
    }),
  [EVENT_TYPES.CONFLICT_REMOVED]: (_state, event) =>
    context({
      intent: "neutral",
      affectedCardIds:
        event.payload?.targetCardIds ?? event.payload?.targetIds ?? [],
      metadata: { conflictId: event.payload?.conflictId },
      validationHints: ["conflict_must_exist_if_removing"],
      possibleWarnings: ["conflict_unresolvable:conflict_target_missing"],
    }),
  [EVENT_TYPES.INSTRUMENT_ROUND_VISIBILITY_CHANGED]: (state, event) =>
    context({
      intent: "card_created",
      affectedCardIds:
        event.payload?.createdAppearanceIds ??
        cardsForColumn(state, event.payload?.instrumentId),
      metadata: {
        columnId: event.payload?.instrumentId,
        visibleAppearanceIndexes: event.payload?.visibleAppearanceIndexes ?? [],
        seedMode: "end_of_visible_rounds",
      },
      validationHints: ["instrument_must_exist_and_be_visible"],
      possibleWarnings: [
        "column_collision_unresolvable:same_column_collision_with_fixed_cards",
      ],
    }),
  [EVENT_TYPES.PLATEAU_PLAYED]: (_state, event) => {
    const affectedCardIds = (event.payload?.targets ?? []).map(targetToCardId);
    const playedResolvedRow =
      event.payload?.playedResolvedRow ??
      event.payload?.targetResolvedRow ??
      null;
    return context({
      intent: "play",
      affectedCardIds,
      playedResolvedRow,
      metadata: {
        visualIndex: event.payload?.visualIndex ?? null,
        playedResolvedRow,
        targets: event.payload?.targets ?? [],
      },
      validationHints: [
        "played_targets_must_be_concrete",
        "playedResolvedRow_must_not_use_local_plateau_index",
      ],
      possibleWarnings: [
        "invalid_action_replayed:played_target_row_mismatch",
        "invalid_action_replayed:played_empty_slot_missing_target_row",
      ],
    });
  },
  [EVENT_TYPES.PLATEAU_UNPLAYED]: (_state, event) =>
    context({
      intent: "unplay",
      affectedCardIds: (event.payload?.targets ?? []).map(targetToCardId),
      metadata: { targets: event.payload?.targets ?? [] },
      validationHints: ["confirm_if_unplaying_history"],
      possibleWarnings: ["missing_target:card_target_missing"],
    }),
  [EVENT_TYPES.TRANSACTION_REVERTED]: (_state, event) =>
    neutral({
      affectedCardIds: event.payload?.affectedCardIds ?? [],
      metadata: {
        revertedTransactionId:
          event.payload?.revertedTransactionId ?? event.payload?.transactionId,
      },
      validationHints: ["undo_must_be_linear"],
      possibleWarnings: ["missing_target:card_target_missing"],
    }),
  [EVENT_TYPES.TRANSACTION_REDONE]: (_state, event) =>
    neutral({
      affectedCardIds: event.payload?.affectedCardIds ?? [],
      metadata: {
        redoneTransactionId:
          event.payload?.redoneTransactionId ?? event.payload?.transactionId,
      },
      validationHints: ["redo_must_be_linear"],
      possibleWarnings: ["missing_target:card_target_missing"],
    }),
});

export const TRANSACTION_CONTEXT_EVENT_TYPES = Object.freeze(
  Object.keys(EVENT_CONTEXT_BUILDERS),
);

function mergeContexts(base, addition) {
  const basePriority = INTENT_PRIORITY[base.intent] ?? 0;
  const additionPriority = INTENT_PRIORITY[addition.intent] ?? 0;
  const primary = additionPriority > basePriority ? addition : base;

  return {
    ...base,
    intent: primary.intent,
    anchorCardId: primary.anchorCardId,
    afterTargetCardId: primary.afterTargetCardId,
    beforeTargetCardId: primary.beforeTargetCardId,
    preferredResolvedRow: primary.preferredResolvedRow,
    playedResolvedRow:
      primary.playedResolvedRow ??
      base.playedResolvedRow ??
      addition.playedResolvedRow,
    skippedCardId:
      primary.skippedCardId ?? base.skippedCardId ?? addition.skippedCardId,
    createdHoleId: addition.createdHoleId ?? base.createdHoleId,
    affectedCardIds: unique([
      ...base.affectedCardIds,
      ...addition.affectedCardIds,
    ]),
    removedLinkIds: unique([
      ...base.removedLinkIds,
      ...addition.removedLinkIds,
    ]),
    validationHints: unique([
      ...base.validationHints,
      ...addition.validationHints,
    ]),
    possibleWarnings: unique([
      ...base.possibleWarnings,
      ...addition.possibleWarnings,
    ]),
    metadata: { ...base.metadata, ...addition.metadata },
  };
}

/**
 * Build the canonical TransactionContext for one full transaction.
 *
 * This function is intentionally not wired into the legacy resolver yet. It
 * folds all events in a transaction before choosing the primary intent, so the
 * future resolver is called once per transaction and never between two events of
 * the same transaction.
 *
 * @param {Object} state Projected state plus optional previous layout caches.
 * @param {{transactionId?: string, events?: Array<{type: string, eventId?: string, payload?: Object, eventIndexInTransaction?: number}>}} transaction
 * @returns {import('./resolverTypes').TransactionContext & {playedResolvedRow: ?number, skippedCardId: ?string, createdHoleId: ?string, removedLinkIds: string[], validationHints: string[], possibleWarnings: string[]}}
 */
export function buildTransactionContext(state = {}, transaction = {}) {
  const events = [...(transaction.events ?? [])].sort((a, b) => {
    const index =
      (a.eventIndexInTransaction ?? 0) - (b.eventIndexInTransaction ?? 0);
    if (index !== 0) return index;
    return String(a.eventId ?? "").localeCompare(String(b.eventId ?? ""));
  });

  let merged = context();
  events.forEach((event) => {
    if (
      !ALLOWED_EVENT_TYPES.includes(event.type) ||
      !EVENT_CONTEXT_BUILDERS[event.type]
    ) {
      throw new Error(
        `Unsupported V0 event type for transactionContext: ${event.type}`,
      );
    }
    merged = mergeContexts(
      merged,
      EVENT_CONTEXT_BUILDERS[event.type](state, event),
    );
  });

  return {
    transactionId: transaction.transactionId ?? events[0]?.transactionId ?? "",
    eventIds: events.map((event) => event.eventId).filter(Boolean),
    ...merged,
  };
}

export function assertTransactionContextCoverage() {
  const missing = ALLOWED_EVENT_TYPES.filter(
    (type) => !EVENT_CONTEXT_BUILDERS[type],
  );
  if (missing.length > 0)
    throw new Error(
      `Missing transactionContext builders for: ${missing.join(", ")}`,
    );
  return true;
}
