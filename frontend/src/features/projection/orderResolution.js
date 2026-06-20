import { hasConflictBetweenTargets, resolveConflictTargets } from './conflicts';
import { getTargetEntity } from './holes';
import { getCardRoundIndex, getPositionInRound, orderBetween, targetKey as formatTargetKey } from './ordering';
import { addProjectionWarning } from './projectionWarnings';

const ANCHOR_EXTRACTORS = {
  appearance_moved_between: (event) => cardTarget('appearance', event.payload?.appearanceId),
  hole_moved_between: (event) => cardTarget('hole', event.payload?.holeId),
  hole_added: (event) => cardTarget('hole', event.payload?.holeId),
  participation_added: (event) => participationAnchorTarget(event.payload),
  appearance_skipped: (event) => cardTarget('appearance', event.payload?.appearanceId),
  plateau_played: (event) => firstTarget(event.payload?.targets),
  appearance_locked: (event) => cardTarget('appearance', event.payload?.appearanceId),
  hole_locked: (event) => cardTarget('hole', event.payload?.holeId),
  appearance_unlocked: (event) => cardTarget('appearance', event.payload?.appearanceId),
  hole_unlocked: (event) => cardTarget('hole', event.payload?.holeId),
};

export function resolveOrderAfterTransaction(state, context = {}) {
  const anchor = extractTransactionAnchor(context.transaction);
  const anchorMode = extractTransactionAnchorMode(context.transaction);
  const manualMoveContext = extractManualMoveContext(context.transaction);
  state.orderResolution = {
    lastTransactionId: context.transaction?.transactionId ?? null,
    anchor,
    anchorMode,
    manualMoveContext,
  };

  applyManualOrderHints(state);

  // Validate active link constraints before resolving the visible order, but do
  // not pre-move link targets here. Manual reorder events must keep priority:
  // if the moved card displaces a linked target, the rest of the link group
  // follows that displaced target during applyResolvedLinkAlignment().
  applyActiveLinks(state);
  assignAllResolvedColumnOrders(state);
  applyResolvedLinkAlignment(state, { anchor, anchorMode, manualMoveContext });
  applyActiveConflicts(state, { anchor });
  applyResolvedLinkAlignment(state, { anchor, anchorMode, manualMoveContext });
  applyActiveConflicts(state, { anchor });
  assignAllResolvedColumnOrders(state);

  return state;
}

function assignAllResolvedColumnOrders(state) {
  getCardsByInstrument(state).forEach((cards) => {
    freezePinnedCards(cards);
    assignResolvedColumnOrder(cards);
  });
}

export function applyManualOrderHints(state) {
  getSortedCardsWithManualHints(state).forEach((card) => {
    const target = card.manualOrderHint?.target ?? cardTarget(card);
    if (isCardLocked(card) || isCardPlayed(card)) {
      addProjectionWarning(state, 'immobile_target', 'move ignored because target is locked or played.', { target });
      return;
    }

    const order = orderBetween(
      getTargetEntity(state, card.manualOrderHint.afterTarget),
      getTargetEntity(state, card.manualOrderHint.beforeTarget),
      card.positionInRound ?? getPositionInRound(card),
    );
    setCardOrder(card, order);
  });
}

export function applyActiveLinks(state) {
  Object.values(state.links)
    .filter((link) => link.status === 'active')
    .sort((a, b) => String(a.linkId ?? a.id).localeCompare(String(b.linkId ?? b.id)))
    .forEach((link) => applyLinkConstraint(state, link));
}

export function applyActiveConflicts(state, { anchor = null } = {}) {
  const conflicts = Object.values(state.conflicts)
    .filter((conflict) => conflict.status === 'active')
    .sort((a, b) => String(a.conflictId ?? a.id).localeCompare(String(b.conflictId ?? b.id)));

  // Re-run a bounded number of passes because moving one card can reveal another
  // conflict on the next plateau. The result stays deterministic because both the
  // conflict order and candidate indexes are stable.
  for (let pass = 0; pass < 20; pass += 1) {
    let moved = false;
    conflicts.forEach((conflict) => {
      if (applyConflictConstraint(state, conflict, anchor)) moved = true;
    });
    if (!moved) break;
  }
}

function applyLinkConstraint(state, link) {
  const targets = link.targets.map((target) => ({ target, entity: getTargetEntity(state, target) })).filter(({ entity }) => isCardActive(entity));
  if (targets.length < 2) {
    link.suppressedByInvalidTargets = true;
    addProjectionWarning(state, 'link_target_missing', 'link ignored because at least two active targets are required.', { linkId: link.linkId });
    return;
  }
  link.suppressedByInvalidTargets = false;
  if (hasDuplicateInstrumentEntries(targets)) {
    link.suppressedBySameColumn = true;
    addProjectionWarning(state, 'link_suppressed_by_same_column', 'link ignored because two targets are in the same column.', { linkId: link.linkId });
    return;
  }
  link.suppressedBySameColumn = false;
  if (hasConflictBetweenTargets(state, link.targets)) {
    link.suppressedByConflict = true;
    addProjectionWarning(state, 'link_suppressed_by_conflict', 'link ignored because its targets have an active direct conflict.', { linkId: link.linkId });
    return;
  }

  link.suppressedByConflict = false;
  // Important: this pass only validates whether the link is usable. It must not
  // mutate positionInRound/orderScore. Real alignment happens later from the
  // resolved plateau indexes, after manual moves have been applied. Otherwise a
  // manual drag involving a linked target can be immediately undone by the
  // default link strategy before the resolver sees the user's intent.
}

function applyConflictConstraint(state, conflict, transactionAnchor) {
  const groups = buildConflictTargetGroups(state, conflict);
  const entries = groups.flatMap((group) => group.entities);
  if (groups.length < 2 || groups.some((group) => group.entities.length === 0)) {
    addProjectionWarning(state, 'conflict_target_missing', 'conflict ignored because at least one target is missing.', { conflictId: conflict.conflictId });
    return false;
  }

  if (conflictTargetGroupsShareInstrument(groups)) {
    conflict.suppressedBySameColumn = true;
    addProjectionWarning(state, 'conflict_suppressed_by_same_column', 'conflict ignored because two targets are in the same column.', { conflictId: conflict.conflictId });
    return false;
  }
  conflict.suppressedBySameColumn = false;

  const conflictingPairs = conflictEntityPairs(groups)
    .filter(([a, b]) => samePlateau(a, b))
    .sort(([a1, b1], [a2, b2]) => {
      const index = getCardPlateauIndex(a1) - getCardPlateauIndex(a2);
      if (index !== 0) return index;
      const aOrder = compareBaseColumnOrder(a1, a2);
      if (aOrder !== 0) return aOrder;
      return compareBaseColumnOrder(b1, b2);
    });

  for (const [first, second] of conflictingPairs) {
    const anchorEntity = chooseConflictAnchor(state, transactionAnchor, first, second);
    const preferredTarget = anchorEntity?.id === first.id ? second : first;

    if (moveConflictTargetAwayFromPlateau(state, preferredTarget, conflict)) return true;

    // If the preferred non-anchor target cannot move because it is pinned or has
    // no valid slot, try the anchor as a last resort when it is mobile. This
    // keeps participation-scope conflicts symmetric across all rounds while
    // still preserving the latest user anchor when possible.
    if (anchorEntity && moveConflictTargetAwayFromPlateau(state, anchorEntity, conflict)) return true;

    addProjectionWarning(state, 'conflict_unresolved', 'conflict could not be resolved without moving a played or locked target.', { conflictId: conflict.conflictId });
  }

  return false;
}

function buildConflictTargetGroups(state, conflict) {
  return conflict.targetIds.map((targetId) => ({
    targetId,
    entities: resolveConflictTargets(state, conflict.scope, targetId).filter(isCardActive),
  }));
}

function conflictEntityPairs(groups) {
  const pairs = [];
  for (let leftIndex = 0; leftIndex < groups.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < groups.length; rightIndex += 1) {
      groups[leftIndex].entities.forEach((left) => {
        groups[rightIndex].entities.forEach((right) => {
          if (left.instrumentId !== right.instrumentId) pairs.push([left, right]);
        });
      });
    }
  }
  return pairs;
}

function conflictTargetGroupsShareInstrument(groups) {
  for (let leftIndex = 0; leftIndex < groups.length; leftIndex += 1) {
    const leftInstruments = new Set(groups[leftIndex].entities.map((entity) => entity.instrumentId).filter(Boolean));
    for (let rightIndex = leftIndex + 1; rightIndex < groups.length; rightIndex += 1) {
      if (groups[rightIndex].entities.some((entity) => leftInstruments.has(entity.instrumentId))) return true;
    }
  }
  return false;
}

function chooseConflictAnchor(state, transactionAnchor, first, second) {
  if (entityMatchesTarget(first, transactionAnchor)) return first;
  if (entityMatchesTarget(second, transactionAnchor)) return second;
  return compareGridOrder(state, first, second) <= 0 ? first : second;
}

function compareGridOrder(state, a, b) {
  const plateauOrder = (getCardPlateauIndex(a) ?? Number.MAX_SAFE_INTEGER) - (getCardPlateauIndex(b) ?? Number.MAX_SAFE_INTEGER);
  if (plateauOrder !== 0) return plateauOrder;

  const instrumentOrder = String(state.instruments?.[a.instrumentId]?.orderKey ?? a.instrumentId ?? '').localeCompare(
    String(state.instruments?.[b.instrumentId]?.orderKey ?? b.instrumentId ?? ''),
  );
  if (instrumentOrder !== 0) return instrumentOrder;

  return compareBaseColumnOrder(a, b);
}

function entityMatchesTarget(entity, target) {
  if (!entity || !target) return false;
  if (target.type === 'appearance') return entity.id === target.id || entity.appearanceId === target.id;
  if (target.type === 'hole') return entity.id === target.id || entity.holeId === target.id;
  if (target.type === 'participation') return entity.participationId === target.id;
  return entityMatchesConflictTarget(entity, target.id);
}

function entityMatchesConflictTarget(entity, targetId) {
  if (!entity || !targetId) return false;
  return [entity.id, entity.appearanceId, entity.holeId, entity.participationId].filter(Boolean).includes(targetId);
}

function linkedOrder(entities, strategy) {
  const values = entities.map(getPositionInRound);
  if (strategy === 'move_to_last') return Math.max(...values);
  if (strategy === 'average_position') return values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.min(...values);
}

function hasDuplicateInstrumentEntries(entries) {
  return hasDuplicateInstrumentEntities(entries.map((entry) => entry.entity));
}

function hasDuplicateInstrumentEntities(entities) {
  const instrumentIds = entities.map((entity) => entity?.instrumentId).filter(Boolean);
  return new Set(instrumentIds).size !== instrumentIds.length;
}

function samePlateau(a, b) {
  const aIndex = getCardPlateauIndex(a);
  const bIndex = getCardPlateauIndex(b);
  return Number.isFinite(aIndex) && Number.isFinite(bIndex) && aIndex === bIndex;
}

function getCardPlateauIndex(card) {
  if (Number.isFinite(card?.resolvedPlateauIndex)) return card.resolvedPlateauIndex;
  if (Number.isFinite(card?.positionInRound)) return card.positionInRound;
  return null;
}

function moveConflictTargetAwayFromPlateau(state, card, conflict) {
  if (isCardPlayed(card) || isCardLocked(card)) {
    addProjectionWarning(state, 'conflict_target_pinned', 'conflict could not move a played or locked target.', { conflictId: conflict.conflictId, target: cardTarget(card) });
    return false;
  }

  const cards = getCardsByInstrument(state).get(card.instrumentId) ?? [];
  const ordered = sortCardsByCurrentResolvedOrder(cards);
  const currentIndex = ordered.findIndex((candidate) => candidate.id === card.id);
  if (currentIndex < 0) return false;

  const candidateIndexes = conflictCandidateIndexes(currentIndex, ordered.length);
  for (const candidateIndex of candidateIndexes) {
    const candidateOrder = moveItemToIndex(ordered, currentIndex, candidateIndex);
    if (pinnedCardsWouldMove(ordered, candidateOrder)) continue;
    if (!columnOrderRespectsConflicts(state, candidateOrder)) continue;
    applyResolvedOrderToColumn(candidateOrder);
    return true;
  }

  addProjectionWarning(state, 'conflict_no_valid_slot', 'conflict could not find another valid slot for a mobile target.', { conflictId: conflict.conflictId, target: cardTarget(card) });
  return false;
}

function conflictCandidateIndexes(currentIndex, length) {
  const indexes = [];
  for (let index = currentIndex + 1; index < length; index += 1) indexes.push(index);
  for (let index = currentIndex - 1; index >= 0; index -= 1) indexes.push(index);
  return indexes;
}

function moveItemToIndex(items, fromIndex, toIndex) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved);
  return next;
}

function pinnedCardsWouldMove(before, after) {
  return before.some((card, index) => {
    if (!isCardPlayed(card) && !isCardLocked(card)) return false;
    return after[index]?.id !== card.id;
  });
}

function columnOrderRespectsConflicts(state, ordered) {
  return ordered.every((card, index) => !hasActiveConflictAtPlateau(state, card, index + 1));
}

function hasActiveConflictAtPlateau(state, card, plateauIndex) {
  return Object.values(state.conflicts).some((conflict) => {
    if (conflict.status !== 'active' || conflict.suppressedBySameColumn) return false;
    const groups = buildConflictTargetGroups(state, conflict);
    const cardGroupIndex = groups.findIndex((group) => group.entities.some((entity) => entity.id === card.id));
    if (cardGroupIndex < 0) return false;
    return groups.some((group, groupIndex) => groupIndex !== cardGroupIndex && group.entities.some((other) => {
      if (!other || other.id === card.id || other.instrumentId === card.instrumentId) return false;
      return getCardPlateauIndex(other) === plateauIndex;
    }));
  });
}

function applyResolvedOrderToColumn(ordered) {
  ordered.forEach((candidate, index) => {
    if (!isCardPlayed(candidate) && !isCardLocked(candidate)) setCardOrder(candidate, index + 1);
    candidate.resolvedPlateauIndex = index + 1;
    candidate.resolvedColumnOrder = index + 1;
    candidate.resolvedOrderKey = buildResolvedOrderKey(candidate, index);
  });
}

function setCardOrder(card, order) {
  card.positionInRound = order;
  card.roundOrder = order;
  card.manualRoundOrder = order;
  card.orderScore = (card.appearanceIndex ?? 1) * 1_000_000 + order;
}

export function applyResolvedLinkAlignment(state, { anchor = null, anchorMode = null, manualMoveContext = null } = {}) {
  Object.values(state.links)
    .filter((link) => link.status === 'active' && !link.suppressedByConflict && !link.suppressedBySameColumn && !link.suppressedByInvalidTargets)
    .sort((a, b) => String(a.linkId ?? a.id).localeCompare(String(b.linkId ?? b.id)))
    .forEach((link) => alignLinkResolvedPlateaux(state, link, { anchor, anchorMode, manualMoveContext }));
}

function alignLinkResolvedPlateaux(state, link, { anchor = null, anchorMode = null, manualMoveContext = null } = {}) {
  const targetEntries = link.targets
    .map((target) => ({ target, entity: getTargetEntity(state, target) }))
    .filter(({ entity }) => isCardActive(entity));
  if (targetEntries.length < 2) return;
  if (hasDuplicateInstrumentEntries(targetEntries)) {
    link.suppressedBySameColumn = true;
    addProjectionWarning(state, 'link_suppressed_by_same_column', 'link ignored because two targets are in the same column.', { linkId: link.linkId });
    return;
  }

  const priorityEntry = linkedManualPriorityEntry(targetEntries, anchor, anchorMode, manualMoveContext);
  const desiredIndex = linkedResolvedIndex(targetEntries, link.reorderStrategy, priorityEntry);
  if (!Number.isFinite(desiredIndex)) return;

  // If a manual move gives priority to one target of a link, that priority is
  // inherited by the whole link group. Each mobile target may therefore push
  // mobile cards in its own column so the group reaches the moved/displaced
  // plateau. Played and locked cards remain fixed and stop that part of the
  // propagation.
  targetEntries
    .sort((a, b) => targetKey(a.target).localeCompare(targetKey(b.target)))
    .forEach(({ target, entity }) => {
      if (isCardPlayed(entity) || isCardLocked(entity)) {
        if ((entity.resolvedPlateauIndex ?? 1) - 1 !== desiredIndex) {
          addProjectionWarning(state, 'link_target_pinned', 'link could not align a played or locked target.', { linkId: link.linkId, target });
        }
        return;
      }
      moveCardToResolvedIndex(state, entity, desiredIndex, { link, target });
    });
}

function linkedManualPriorityEntry(targetEntries, anchor = null, anchorMode = null, manualMoveContext = null) {
  if (anchorMode !== 'manual_move') return null;
  const movedTarget = manualMoveContext?.target ?? anchor;
  const movedKey = targetKey(movedTarget);
  if (movedKey) {
    const movedEntry = targetEntries.find(({ target }) => targetKey(target) === movedKey);
    if (movedEntry) return movedEntry;
  }

  return manualMoveContext ? linkedEntryTouchedByManualMove(targetEntries, manualMoveContext) : null;
}

function linkedResolvedIndex(targetEntries, strategy, priorityEntry = null) {
  if (priorityEntry) return (priorityEntry.entity.resolvedPlateauIndex ?? 1) - 1;
  const indexes = targetEntries
    .map(({ entity }) => (entity.resolvedPlateauIndex ?? 1) - 1)
    .filter(Number.isFinite);
  if (indexes.length === 0) return null;
  if (strategy === 'move_to_last') return Math.max(...indexes);
  if (strategy === 'average_position') {
    const average = indexes.reduce((sum, index) => sum + index, 0) / indexes.length;
    return Math.round(average);
  }
  return Math.min(...indexes);
}

function linkedEntryTouchedByManualMove(targetEntries, manualMoveContext) {
  const beforeKey = targetKey(manualMoveContext.beforeTarget);
  if (beforeKey) {
    const beforeEntry = targetEntries.find(({ target }) => targetKey(target) === beforeKey);
    if (beforeEntry) return beforeEntry;
  }

  const afterKey = targetKey(manualMoveContext.afterTarget);
  if (afterKey) {
    const afterEntry = targetEntries.find(({ target }) => targetKey(target) === afterKey);
    if (afterEntry) return afterEntry;
  }

  return null;
}

function moveCardToResolvedIndex(state, card, desiredIndex, { link = null, target = null } = {}) {
  const cards = getCardsByInstrument(state).get(card.instrumentId) ?? [];
  const ordered = sortCardsByCurrentResolvedOrder(cards);
  const currentIndex = ordered.findIndex((candidate) => candidate.id === card.id);
  if (currentIndex < 0) return false;
  const boundedIndex = Math.max(0, Math.min(desiredIndex, ordered.length - 1));
  if (currentIndex === boundedIndex) return true;

  const candidateOrder = moveItemToIndex(ordered, currentIndex, boundedIndex);
  if (pinnedCardsWouldMove(ordered, candidateOrder)) {
    addProjectionWarning(state, 'link_target_pinned', 'link could not align without moving a played or locked target.', {
      linkId: link?.linkId,
      target: target ?? cardTarget(card),
    });
    return false;
  }

  applyResolvedOrderToColumn(candidateOrder);
  return true;
}

function getSortedCardsWithManualHints(state) {
  return [...Object.values(state.appearances), ...Object.values(state.holes)]
    .filter((card) => isCardActive(card) && card.manualOrderHint)
    .sort((a, b) => {
      const transaction = String(a.manualOrderHint.transactionId ?? '').localeCompare(String(b.manualOrderHint.transactionId ?? ''));
      if (transaction !== 0) return transaction;
      const eventIndex = (a.manualOrderHint.eventIndexInTransaction ?? 0) - (b.manualOrderHint.eventIndexInTransaction ?? 0);
      if (eventIndex !== 0) return eventIndex;
      return targetKey(cardTarget(a)).localeCompare(targetKey(cardTarget(b)));
    });
}

export function targetKey(target) {
  return target ? formatTargetKey(target) : '';
}

export function cardTarget(typeOrCard, id) {
  if (typeof typeOrCard === 'string') {
    if (!id) return null;
    return { type: typeOrCard, id };
  }
  const card = typeOrCard;
  if (!card) return null;
  return { type: card.type, id: card.id ?? card.appearanceId ?? card.holeId };
}

export function isCardActive(card) {
  return Boolean(card) && card.status !== 'removed';
}

export function isCardPlayed(card) {
  return Boolean(card?.played);
}

export function isCardLocked(card) {
  return Boolean(card?.locked);
}

export function getInstrumentIdForCard(card) {
  return card?.instrumentId ?? null;
}

export function getCardsByInstrument(state) {
  const byInstrument = new Map();
  [...Object.values(state.appearances), ...Object.values(state.holes)]
    .filter(isCardActive)
    .forEach((card) => {
      const instrumentId = getInstrumentIdForCard(card);
      if (!instrumentId) return;
      if (!byInstrument.has(instrumentId)) byInstrument.set(instrumentId, []);
      byInstrument.get(instrumentId).push(card);
    });
  return byInstrument;
}

export function sortCardsByCurrentResolvedOrder(cards) {
  return [...cards].sort((a, b) => {
    const resolved = (a.resolvedColumnOrder ?? Number.MAX_SAFE_INTEGER) - (b.resolvedColumnOrder ?? Number.MAX_SAFE_INTEGER);
    if (resolved !== 0) return resolved;
    return compareBaseColumnOrder(a, b);
  });
}

export function freezePinnedCards(cards) {
  const currentOrder = sortCardsByCurrentResolvedOrder(cards);
  currentOrder.forEach((card, index) => {
    const currentPlateauIndex = card.resolvedPlateauIndex ?? index + 1;
    if (isCardPlayed(card) && !Number.isFinite(card.playedAtPlateauIndex)) {
      card.playedAtPlateauIndex = currentPlateauIndex;
      card.frozenOrderKey = buildFrozenOrderKey('played', currentPlateauIndex, card);
    }
    if (isCardLocked(card) && !Number.isFinite(card.lockedAtPlateauIndex)) {
      card.lockedAtPlateauIndex = currentPlateauIndex;
      card.frozenOrderKey = card.frozenOrderKey ?? buildFrozenOrderKey('locked', currentPlateauIndex, card);
    }
    if (!isCardPlayed(card)) delete card.playedAtPlateauIndex;
    if (!isCardLocked(card)) delete card.lockedAtPlateauIndex;
    if (!isCardPlayed(card) && !isCardLocked(card)) delete card.frozenOrderKey;
  });
}

export function assignResolvedColumnOrder(cards) {
  const sortedPins = cards
    .filter((card) => isCardPlayed(card) || isCardLocked(card))
    .sort(comparePinnedCards);
  const mobileCards = cards
    .filter((card) => !isCardPlayed(card) && !isCardLocked(card))
    .sort(compareBaseColumnOrder);
  const pinByIndex = new Map();
  sortedPins.forEach((card) => {
    const pinIndex = getPinnedPlateauIndex(card);
    if (!pinByIndex.has(pinIndex)) pinByIndex.set(pinIndex, []);
    pinByIndex.get(pinIndex).push(card);
  });

  const resolved = [];
  let mobileIndex = 0;
  for (let plateauIndex = 1; resolved.length < cards.length; plateauIndex += 1) {
    const pins = pinByIndex.get(plateauIndex) ?? [];
    pins.forEach((pin) => resolved.push(pin));
    if (pins.length === 0 && mobileIndex < mobileCards.length) {
      resolved.push(mobileCards[mobileIndex]);
      mobileIndex += 1;
    }
    if (plateauIndex > cards.length + sortedPins.length + 100) break;
  }
  while (mobileIndex < mobileCards.length) {
    resolved.push(mobileCards[mobileIndex]);
    mobileIndex += 1;
  }

  resolved.forEach((card, index) => {
    card.resolvedPlateauIndex = index + 1;
    card.resolvedColumnOrder = index + 1;
    card.resolvedOrderKey = buildResolvedOrderKey(card, index);
    if (Number.isFinite(card.manualRoundOrder)) card.manualOrderKey = buildManualOrderKey(card);
  });
}

function compareBaseColumnOrder(a, b) {
  const roundOrder = getCardRoundIndex(a) - getCardRoundIndex(b);
  if (roundOrder !== 0) return roundOrder;
  const positionOrder = getPositionInRound(a) - getPositionInRound(b);
  if (positionOrder !== 0) return positionOrder;
  return targetKey(cardTarget(a)).localeCompare(targetKey(cardTarget(b)));
}

function comparePinnedCards(a, b) {
  const priority = pinPriority(a) - pinPriority(b);
  if (priority !== 0) return priority;
  const plateau = getPinnedPlateauIndex(a) - getPinnedPlateauIndex(b);
  if (plateau !== 0) return plateau;
  return compareBaseColumnOrder(a, b);
}

function pinPriority(card) {
  if (isCardPlayed(card)) return 1;
  if (isCardLocked(card)) return 2;
  return 3;
}

function getPinnedPlateauIndex(card) {
  if (isCardPlayed(card) && Number.isFinite(card.playedAtPlateauIndex)) return card.playedAtPlateauIndex;
  if (isCardLocked(card) && Number.isFinite(card.lockedAtPlateauIndex)) return card.lockedAtPlateauIndex;
  return card.resolvedPlateauIndex ?? Number.MAX_SAFE_INTEGER;
}

function buildFrozenOrderKey(kind, plateauIndex, card) {
  return [kind, String(plateauIndex).padStart(6, '0'), targetKey(cardTarget(card))].join(':');
}

function buildManualOrderKey(card) {
  return ['manual', String(getPositionInRound(card)).padStart(12, '0'), targetKey(cardTarget(card))].join(':');
}

export function extractTransactionAnchor(transaction) {
  const events = [...(transaction?.events ?? [])].sort((a, b) => {
    const index = (a.eventIndexInTransaction ?? 0) - (b.eventIndexInTransaction ?? 0);
    if (index !== 0) return index;
    return String(a.eventId ?? '').localeCompare(String(b.eventId ?? ''));
  });

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const anchor = extractEventAnchor(events[index]);
    if (anchor) return anchor;
  }
  return null;
}

function extractTransactionAnchorMode(transaction) {
  const events = transaction?.events ?? [];
  if (events.some((event) => event.type === 'appearance_moved_between' || event.type === 'hole_moved_between')) return 'manual_move';
  if (events.some((event) => event.type === 'link_created')) return 'link_created';
  if (events.some((event) => event.type === 'conflict_created')) return 'conflict_created';
  if (events.some((event) => event.type === 'participation_added')) return 'participation_added';
  return null;
}

function extractManualMoveContext(transaction) {
  const events = [...(transaction?.events ?? [])].sort((a, b) => {
    const index = (a.eventIndexInTransaction ?? 0) - (b.eventIndexInTransaction ?? 0);
    if (index !== 0) return index;
    return String(a.eventId ?? '').localeCompare(String(b.eventId ?? ''));
  });
  const moveEvent = [...events].reverse().find((event) => event.type === 'appearance_moved_between' || event.type === 'hole_moved_between');
  if (!moveEvent) return null;
  return {
    target: extractEventAnchor(moveEvent),
    afterTarget: moveEvent.payload?.afterTarget ? { ...moveEvent.payload.afterTarget } : null,
    beforeTarget: moveEvent.payload?.beforeTarget ? { ...moveEvent.payload.beforeTarget } : null,
  };
}

export function extractEventAnchor(event) {
  return ANCHOR_EXTRACTORS[event?.type]?.(event) ?? null;
}

function participationAnchorTarget(payload = {}) {
  if (!payload.participationId) return null;
  const appearanceIndex = payload.startAppearanceIndex ?? 1;
  return cardTarget('appearance', `appearance_${payload.participationId}_${appearanceIndex}`);
}

function firstTarget(targets) {
  return Array.isArray(targets) ? targets[0] ?? null : null;
}

function buildResolvedOrderKey(card, index) {
  const round = Number.isFinite(card?.appearanceIndex) ? card.appearanceIndex : 1;
  const position = getPositionInRound(card);
  return [String(round).padStart(6, '0'), String(position).padStart(12, '0'), String(index).padStart(6, '0'), targetKey(cardTarget(card))].join(':');
}
