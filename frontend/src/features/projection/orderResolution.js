import { hasConflictBetweenTargets, resolveConflictTarget } from './conflicts';
import { getTargetEntity } from './holes';
import { getCardRoundIndex, getPositionInRound, orderBetween, targetKey as formatTargetKey } from './ordering';
import { addProjectionWarning } from './projectionWarnings';

const ANCHOR_EXTRACTORS = {
  appearance_moved_between: (event) => cardTarget('appearance', event.payload?.appearanceId),
  hole_moved_between: (event) => cardTarget('hole', event.payload?.holeId),
  hole_added: (event) => cardTarget('hole', event.payload?.holeId),
  link_created: (event) => event.payload?.anchorTarget ?? null,
  conflict_created: (event) => targetFromAnchorTargetId(event.payload?.anchorTargetId),
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
  state.orderResolution = {
    lastTransactionId: context.transaction?.transactionId ?? null,
    anchor,
  };

  applyManualOrderHints(state);

  applyActiveLinks(state, { anchor });
  applyActiveConflicts(state, { anchor });

  getCardsByInstrument(state).forEach((cards) => {
    freezePinnedCards(cards);
    assignResolvedColumnOrder(cards);
  });
  applyResolvedLinkAlignment(state);

  return state;
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

export function applyActiveLinks(state, { anchor = null } = {}) {
  Object.values(state.links)
    .filter((link) => link.status === 'active')
    .sort((a, b) => String(a.linkId ?? a.id).localeCompare(String(b.linkId ?? b.id)))
    .forEach((link) => applyLinkConstraint(state, link, anchor));
}

export function applyActiveConflicts(state, { anchor = null } = {}) {
  Object.values(state.conflicts)
    .filter((conflict) => conflict.status === 'active')
    .sort((a, b) => String(a.conflictId ?? a.id).localeCompare(String(b.conflictId ?? b.id)))
    .forEach((conflict) => applyConflictConstraint(state, conflict, anchor));
}

function applyLinkConstraint(state, link, transactionAnchor) {
  const targets = link.targets.map((target) => ({ target, entity: getTargetEntity(state, target) })).filter(({ entity }) => isCardActive(entity));
  if (targets.length < 2) {
    link.suppressedByConflict = true;
    addProjectionWarning(state, 'link_target_missing', 'link ignored because at least one target is missing.', { linkId: link.linkId });
    return;
  }
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
  const order = linkedOrder(targets.map(({ entity }) => entity), link.reorderStrategy);
  targets.forEach(({ target, entity }) => {
    if (isCardPlayed(entity) || isCardLocked(entity)) {
      if (getPositionInRound(entity) !== order) {
        addProjectionWarning(state, 'link_target_pinned', 'link could not move a played or locked target.', { linkId: link.linkId, target });
      }
      return;
    }
    setCardOrder(entity, order);
  });
}

function applyConflictConstraint(state, conflict, transactionAnchor) {
  const entries = conflict.targetIds
    .map((id) => resolveConflictTarget(state, conflict.scope, id))
    .filter((entity) => isCardActive(entity));
  if (entries.length < 2) {
    addProjectionWarning(state, 'conflict_target_missing', 'conflict ignored because at least one target is missing.', { conflictId: conflict.conflictId });
    return;
  }

  if (hasDuplicateInstrumentEntries(entries.map((entity) => ({ entity })))) {
    conflict.suppressedBySameColumn = true;
    addProjectionWarning(state, 'conflict_suppressed_by_same_column', 'conflict ignored because two targets are in the same column.', { conflictId: conflict.conflictId });
    return;
  }
  conflict.suppressedBySameColumn = false;

  const anchorEntity = resolveConflictTarget(state, conflict.scope, conflict.anchorTargetId)
    ?? entries.find((entity) => targetKey(cardTarget(entity)) === targetKey(transactionAnchor))
    ?? entries[0];
  entries
    .filter((entity) => entity.id !== anchorEntity.id)
    .sort(compareBaseColumnOrder)
    .forEach((entity, index) => {
      if (!samePlateau(entity, anchorEntity) && getPositionInRound(entity) !== getPositionInRound(anchorEntity)) return;
      if (isCardPlayed(entity) || isCardLocked(entity)) {
        addProjectionWarning(state, 'conflict_target_pinned', 'conflict could not move a played or locked target.', { conflictId: conflict.conflictId, target: cardTarget(entity) });
        return;
      }
      setCardOrder(entity, getPositionInRound(anchorEntity) + index + 1);
    });
}

function linkedOrder(entities, strategy) {
  const values = entities.map(getPositionInRound);
  if (strategy === 'move_to_last') return Math.max(...values);
  if (strategy === 'average_position') return values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.min(...values);
}

function hasDuplicateInstrumentEntries(entries) {
  const instrumentIds = entries.map((entry) => entry.entity?.instrumentId).filter(Boolean);
  return new Set(instrumentIds).size !== instrumentIds.length;
}

function samePlateau(a, b) {
  return Number.isFinite(a?.resolvedPlateauIndex) && a.resolvedPlateauIndex === b?.resolvedPlateauIndex;
}

function setCardOrder(card, order) {
  card.positionInRound = order;
  card.roundOrder = order;
  card.manualRoundOrder = order;
  card.orderScore = (card.appearanceIndex ?? 1) * 1_000_000 + order;
}


export function applyResolvedLinkAlignment(state) {
  Object.values(state.links)
    .filter((link) => link.status === 'active' && !link.suppressedByConflict && !link.suppressedBySameColumn)
    .sort((a, b) => String(a.linkId ?? a.id).localeCompare(String(b.linkId ?? b.id)))
    .forEach((link) => alignLinkResolvedPlateaux(state, link));
}

function alignLinkResolvedPlateaux(state, link) {
  const targetEntries = link.targets
    .map((target) => ({ target, entity: getTargetEntity(state, target) }))
    .filter(({ entity }) => isCardActive(entity));
  if (targetEntries.length < 2) return;
  if (hasDuplicateInstrumentEntries(targetEntries)) {
    link.suppressedBySameColumn = true;
    addProjectionWarning(state, 'link_suppressed_by_same_column', 'link ignored because two targets are in the same column.', { linkId: link.linkId });
    return;
  }

  const desiredIndex = linkedResolvedIndex(targetEntries, link.reorderStrategy);
  if (!Number.isFinite(desiredIndex)) return;

  targetEntries
    .sort((a, b) => targetKey(a.target).localeCompare(targetKey(b.target)))
    .forEach(({ target, entity }) => {
      if (isCardPlayed(entity) || isCardLocked(entity)) {
        if ((entity.resolvedPlateauIndex ?? 1) - 1 !== desiredIndex) {
          addProjectionWarning(state, 'link_target_pinned', 'link could not align a played or locked target.', { linkId: link.linkId, target });
        }
        return;
      }
      moveCardToResolvedIndex(state, entity, desiredIndex);
    });
}

function linkedResolvedIndex(targetEntries, strategy) {
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

function moveCardToResolvedIndex(state, card, desiredIndex) {
  const cards = getCardsByInstrument(state).get(card.instrumentId) ?? [];
  const ordered = sortCardsByCurrentResolvedOrder(cards);
  const currentIndex = ordered.findIndex((candidate) => candidate.id === card.id);
  if (currentIndex < 0) return;
  const [moved] = ordered.splice(currentIndex, 1);
  const boundedIndex = Math.max(0, Math.min(desiredIndex, ordered.length));
  ordered.splice(boundedIndex, 0, moved);
  ordered.forEach((candidate, index) => {
    candidate.resolvedPlateauIndex = index + 1;
    candidate.resolvedColumnOrder = index + 1;
    candidate.resolvedOrderKey = buildResolvedOrderKey(candidate, index);
  });
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

export function extractEventAnchor(event) {
  return ANCHOR_EXTRACTORS[event?.type]?.(event) ?? null;
}

function participationAnchorTarget(payload = {}) {
  if (!payload.participationId) return null;
  const appearanceIndex = payload.startAppearanceIndex ?? 1;
  return cardTarget('appearance', `appearance_${payload.participationId}_${appearanceIndex}`);
}

function targetFromAnchorTargetId(anchorTargetId) {
  if (!anchorTargetId) return null;
  if (String(anchorTargetId).startsWith('hole_')) return cardTarget('hole', anchorTargetId);
  return cardTarget('appearance', anchorTargetId);
}

function firstTarget(targets) {
  return Array.isArray(targets) ? targets[0] ?? null : null;
}

function buildResolvedOrderKey(card, index) {
  const round = Number.isFinite(card?.appearanceIndex) ? card.appearanceIndex : 1;
  const position = getPositionInRound(card);
  return [String(round).padStart(6, '0'), String(position).padStart(12, '0'), String(index).padStart(6, '0'), targetKey(cardTarget(card))].join(':');
}
