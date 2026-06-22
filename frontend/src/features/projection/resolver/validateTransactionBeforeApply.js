import {
  ALLOWED_EVENT_TYPES,
  EVENT_TYPES,
} from "../../../shared/constants/eventTypes";

function targetToCardId(target) {
  if (!target) return null;
  if (typeof target === "string") return target;
  return (
    target.id ?? target.cardId ?? target.appearanceId ?? target.holeId ?? null
  );
}

function linkTargets(payload = {}) {
  if (Array.isArray(payload.targetCardIds)) return payload.targetCardIds;
  if (Array.isArray(payload.targets))
    return payload.targets.map(targetToCardId).filter(Boolean);
  return [];
}

function cardById(state, cardId) {
  return state?.appearances?.[cardId] ?? state?.holes?.[cardId] ?? null;
}

function participantById(state, participantId) {
  return state?.participants?.[participantId] ?? null;
}

function participationById(state, participationId) {
  return state?.participations?.[participationId] ?? null;
}

function cardColumnId(card) {
  return card?.columnId ?? card?.instrumentId ?? null;
}

function cardConflictIds(cardId, card) {
  return [cardId, card?.participationId].filter(Boolean);
}

function isActiveLink(link) {
  return link?.active === true || link?.status === "active";
}

function isActiveConflict(conflict) {
  return conflict?.active === true || conflict?.status === "active";
}

function activeLinkTargets(link) {
  return (
    link.targetCardIds ??
    (link.targets ?? []).map(targetToCardId).filter(Boolean)
  );
}

function fail(reason, message, details = {}) {
  return { ok: false, reason, message, details };
}

function validateCardExists(state, cardId, details = {}) {
  if (!cardId || !cardById(state, cardId)) {
    return fail("missing_target", "Target card is missing or invalid.", {
      cardId,
      ...details,
    });
  }
  return null;
}

function hasDirectConflict(state, leftCardId, rightCardId) {
  const left = cardById(state, leftCardId);
  const right = cardById(state, rightCardId);
  if (!left || !right) return false;
  const leftIds = cardConflictIds(leftCardId, left);
  const rightIds = cardConflictIds(rightCardId, right);
  return Object.values(state?.conflicts ?? {}).some((conflict) => {
    if (!isActiveConflict(conflict)) return false;
    const targetIds = conflict.targetCardIds ?? conflict.targetIds ?? [];
    return (
      targetIds.some((targetId) => leftIds.includes(targetId)) &&
      targetIds.some((targetId) => rightIds.includes(targetId))
    );
  });
}

function areDirectlyLinked(state, leftCardId, rightCardId) {
  return Object.values(state?.links ?? {}).some((link) => {
    if (!isActiveLink(link)) return false;
    const targets = activeLinkTargets(link);
    return targets.includes(leftCardId) && targets.includes(rightCardId);
  });
}

function validateManualMove(state, event, cardId) {
  const missing = validateCardExists(state, cardId, { eventId: event.eventId });
  if (missing) return missing;

  const card = cardById(state, cardId);
  if (card.played)
    return fail(
      "card_played_cannot_move",
      "A played card cannot be moved manually.",
      { cardId, eventId: event.eventId },
    );
  if (card.locked)
    return fail(
      "card_locked_cannot_move",
      "A locked card cannot be moved manually.",
      { cardId, eventId: event.eventId },
    );

  const moveColumnId = cardColumnId(card);
  const bounds = [event.payload?.afterTarget, event.payload?.beforeTarget]
    .map(targetToCardId)
    .filter(Boolean);
  for (const boundCardId of bounds) {
    const boundMissing = validateCardExists(state, boundCardId, {
      eventId: event.eventId,
    });
    if (boundMissing) return boundMissing;
    if (cardColumnId(cardById(state, boundCardId)) !== moveColumnId) {
      return fail(
        "move_changes_column",
        "A manual move cannot change the card column.",
        { cardId, boundCardId, eventId: event.eventId },
      );
    }
  }
  return null;
}

function validateLinkCreated(state, event) {
  const targets = linkTargets(event.payload);
  if (targets.length < 2)
    return fail(
      "missing_target",
      "A link requires at least two valid targets.",
      { eventId: event.eventId, cardIds: targets },
    );

  const columns = new Map();
  for (const cardId of targets) {
    const missing = validateCardExists(state, cardId, {
      eventId: event.eventId,
    });
    if (missing) return missing;
    const columnId = cardColumnId(cardById(state, cardId));
    if (columns.has(columnId)) {
      return fail(
        "link_targets_same_column",
        "Impossible de lier deux cards de la même colonne.",
        {
          eventId: event.eventId,
          cardIds: [columns.get(columnId), cardId],
          columnId,
        },
      );
    }
    columns.set(columnId, cardId);
  }

  for (let leftIndex = 0; leftIndex < targets.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < targets.length;
      rightIndex += 1
    ) {
      if (hasDirectConflict(state, targets[leftIndex], targets[rightIndex])) {
        return fail(
          "link_targets_direct_conflict",
          "Impossible de lier deux cards déjà en conflict.",
          {
            eventId: event.eventId,
            cardIds: [targets[leftIndex], targets[rightIndex]],
          },
        );
      }
    }
  }
  return null;
}

function validateConflictCreated(state, event) {
  const targets =
    event.payload?.targetCardIds ?? event.payload?.targetIds ?? [];
  if (targets.length < 2)
    return fail(
      "missing_target",
      "A conflict requires at least two valid targets.",
      { eventId: event.eventId, cardIds: targets },
    );
  for (const cardId of targets) {
    const missing = validateCardExists(state, cardId, {
      eventId: event.eventId,
    });
    if (missing) return missing;
  }
  for (let leftIndex = 0; leftIndex < targets.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < targets.length;
      rightIndex += 1
    ) {
      if (areDirectlyLinked(state, targets[leftIndex], targets[rightIndex])) {
        return fail(
          "conflict_targets_same_link_group",
          "Impossible de créer un conflict entre deux cards déjà linkées.",
          {
            eventId: event.eventId,
            cardIds: [targets[leftIndex], targets[rightIndex]],
          },
        );
      }
    }
  }
  return null;
}

function validateCardDeletion(state, event, cardId, kind) {
  const missing = validateCardExists(state, cardId, { eventId: event.eventId });
  if (missing) return missing;
  if (cardById(state, cardId).played) {
    return fail(
      kind === "hole"
        ? "played_hole_cannot_be_deleted"
        : "played_card_cannot_be_deleted",
      kind === "hole"
        ? "A played hole cannot be deleted."
        : "A played card cannot be deleted.",
      { eventId: event.eventId, cardId },
    );
  }
  return null;
}

function validateTargetEntity(entity, id, kind, event) {
  if (!id || !entity)
    return fail("missing_target", `${kind} target is missing or invalid.`, {
      eventId: event.eventId,
      targetId: id,
      targetKind: kind,
    });
  return null;
}

function validateEvent(state, event) {
  if (!ALLOWED_EVENT_TYPES.includes(event.type)) {
    return fail(
      "unsupported_event_type",
      "Unsupported Confiture V0 event type.",
      { eventId: event.eventId, eventType: event.type },
    );
  }

  switch (event.type) {
    case EVENT_TYPES.APPEARANCE_MOVED_BETWEEN:
      return validateManualMove(state, event, event.payload?.appearanceId);
    case EVENT_TYPES.HOLE_MOVED_BETWEEN:
      return validateManualMove(state, event, event.payload?.holeId);
    case EVENT_TYPES.LINK_CREATED:
      return validateLinkCreated(state, event);
    case EVENT_TYPES.CONFLICT_CREATED:
      return validateConflictCreated(state, event);
    case EVENT_TYPES.APPEARANCE_REMOVED:
      return validateCardDeletion(
        state,
        event,
        event.payload?.appearanceId,
        "appearance",
      );
    case EVENT_TYPES.HOLE_REMOVED:
      return validateCardDeletion(state, event, event.payload?.holeId, "hole");
    case EVENT_TYPES.APPEARANCE_LOCKED:
    case EVENT_TYPES.APPEARANCE_UNLOCKED:
      return validateCardExists(state, event.payload?.appearanceId, {
        eventId: event.eventId,
      });
    case EVENT_TYPES.HOLE_LOCKED:
    case EVENT_TYPES.HOLE_UNLOCKED:
      return validateCardExists(state, event.payload?.holeId, {
        eventId: event.eventId,
      });
    case EVENT_TYPES.APPEARANCE_SKIPPED: {
      const cardId = event.payload?.appearanceId;
      const missing = validateCardExists(state, cardId, {
        eventId: event.eventId,
      });
      if (missing) return missing;
      const card = cardById(state, cardId);
      if (card.played)
        return fail(
          "skip_target_played",
          "A played appearance cannot be skipped.",
          { eventId: event.eventId, cardId },
        );
      if (card.locked)
        return fail(
          "skip_target_locked",
          "A locked appearance cannot be skipped.",
          { eventId: event.eventId, cardId },
        );
      return null;
    }
    case EVENT_TYPES.PARTICIPANT_REMOVED:
    case EVENT_TYPES.PARTICIPANT_MARKED_LEFT:
      return validateTargetEntity(
        participantById(state, event.payload?.participantId),
        event.payload?.participantId,
        "participant",
        event,
      );
    case EVENT_TYPES.PARTICIPATION_REMOVED:
      return validateTargetEntity(
        participationById(state, event.payload?.participationId),
        event.payload?.participationId,
        "participation",
        event,
      );
    default:
      return null;
  }
}

/**
 * Central pre-apply validation for local/UI transactions.
 *
 * This module is deliberately independent from React and JamTable. UI handlers
 * and defensive replay code can call it before applying a transaction, while the
 * legacy resolver remains unchanged until the new resolver is wired.
 *
 * @param {Object} state Projected state containing cards, links and conflicts.
 * @param {{transactionId?: string, events?: Array<{type: string, eventId?: string, payload?: Object}>}} transaction
 * @returns {{ok: true, warnings: []} | {ok: false, reason: string, message: string, details: Object}}
 */
export function validateTransactionBeforeApply(state = {}, transaction = {}) {
  const events = transaction.events ?? [];
  for (const event of events) {
    const error = validateEvent(state, event);
    if (error)
      return {
        ...error,
        details: {
          transactionId:
            transaction.transactionId ?? event.transactionId ?? null,
          ...error.details,
        },
      };
  }
  return { ok: true, warnings: [] };
}
