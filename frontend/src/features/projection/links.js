import { hasConflictBetween } from './conflicts.js';

export function normalizeTarget(target) {
  if (!target) return null;
  return {
    type: target.type ?? target.targetType,
    id: target.id ?? target.targetId,
  };
}

export function targetKey(target) {
  const normalized = normalizeTarget(target);
  return normalized ? `${normalized.type}:${normalized.id}` : null;
}

export function linkTargets(link) {
  return (link.targets ?? []).map(normalizeTarget).filter(Boolean);
}

export function isTargetInLink(link, target) {
  const key = targetKey(target);
  return Boolean(key && linkTargets(link).some((candidate) => targetKey(candidate) === key));
}

export function removeLinksTargeting(state, target) {
  Object.values(state.links).forEach((link) => {
    if (!link.removed && isTargetInLink(link, target)) {
      link.removed = true;
    }
  });
}

export function activeLinksForTarget(state, target) {
  return Object.values(state.links).filter((link) => !link.removed && isTargetInLink(link, target));
}

export function isLinked(state, target) {
  return activeLinksForTarget(state, target).length > 0;
}

function entityForTarget(state, target) {
  const normalized = normalizeTarget(target);
  if (!normalized) return null;
  return normalized.type === 'hole' ? state.holes[normalized.id] : state.appearances[normalized.id];
}

function targetInstrumentId(state, target) {
  return entityForTarget(state, target)?.instrumentId ?? null;
}

function targetParticipationId(state, target) {
  const entity = entityForTarget(state, target);
  return target?.type === 'appearance' ? entity?.participationId : null;
}

function isTargetLocked(state, target) {
  const normalized = normalizeTarget(target);
  return Object.values(state.locks).some((lock) => !lock.removed && lock.targetType === normalized?.type && lock.targetId === normalized?.id);
}

function isTargetPlayed(state, target) {
  const normalized = normalizeTarget(target);
  return Boolean(state.playedTargets[`${normalized?.type}:${normalized?.id}`]);
}

function numericOrder(entity) {
  const value = Number.parseFloat(entity?.orderKey ?? entity?.positionKey);
  return Number.isFinite(value) ? value : null;
}

function linkedOrder(orders, strategy) {
  const numericOrders = orders.filter((order) => order !== null);
  if (numericOrders.length === 0) return null;
  if (strategy === 'move_to_last') return Math.max(...numericOrders);
  if (strategy === 'average_position') return numericOrders.reduce((sum, order) => sum + order, 0) / numericOrders.length;
  return Math.min(...numericOrders);
}

function movedOrder(entities) {
  const moved = entities
    .filter((entity) => Number.isFinite(entity.lastMovedSequenceNumber))
    .sort((left, right) => right.lastMovedSequenceNumber - left.lastMovedSequenceNumber)[0];
  return numericOrder(moved);
}

function targetsConflict(state, firstTarget, secondTarget) {
  if (firstTarget.type === 'hole' || secondTarget.type === 'hole') return false;
  const firstEntity = entityForTarget(state, firstTarget);
  const secondEntity = entityForTarget(state, secondTarget);
  if (!firstEntity || !secondEntity) return false;
  return hasConflictBetween(state, { scope: 'appearance', firstId: firstTarget.id, secondId: secondTarget.id })
    || hasConflictBetween(state, { scope: 'participation', firstId: firstEntity.participationId, secondId: secondEntity.participationId });
}

export function validateLink(state, link) {
  const targets = linkTargets(link);
  const seenInstruments = new Set();
  const warnings = [];

  for (const target of targets) {
    const entity = entityForTarget(state, target);
    if (!entity || entity.removed || entity.skipped) warnings.push({ type: 'link_ignored_missing_target', linkId: link.linkId, target });
    if (isTargetLocked(state, target)) warnings.push({ type: 'link_ignored_locked_target', linkId: link.linkId, target });
    if (isTargetPlayed(state, target)) warnings.push({ type: 'link_ignored_played_target', linkId: link.linkId, target });
    const instrumentId = targetInstrumentId(state, target);
    if (instrumentId && seenInstruments.has(instrumentId)) warnings.push({ type: 'link_ignored_multiple_targets_same_instrument', linkId: link.linkId, instrumentId });
    if (instrumentId) seenInstruments.add(instrumentId);
  }

  for (let index = 0; index < targets.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < targets.length; otherIndex += 1) {
      if (targetsConflict(state, targets[index], targets[otherIndex])) warnings.push({ type: 'link_ignored_conflicting_targets', linkId: link.linkId, targets: [targets[index], targets[otherIndex]] });
    }
  }

  return warnings;
}

export function invalidateInvalidLinks(state) {
  for (const link of Object.values(state.links)) {
    if (link.removed) continue;
    const warnings = validateLink(state, link);
    if (warnings.length > 0) {
      link.removed = true;
      state.projectionWarnings.push(...warnings);
    }
  }
  return state;
}

export function applyLinkReordering(state) {
  invalidateInvalidLinks(state);
  for (const link of Object.values(state.links)) {
    if (link.removed) continue;
    const targets = linkTargets(link);
    const entities = targets.map((target) => entityForTarget(state, target)).filter(Boolean);
    if (entities.length < 2) continue;
    const order = movedOrder(entities) ?? linkedOrder(entities.map(numericOrder), link.reorderStrategy ?? state.jam?.linkReorderStrategy ?? 'move_to_first');
    if (order === null) continue;
    for (const entity of entities) {
      entity.orderKey = String(order);
      entity.positionKey = String(order);
    }
  }
  return state;
}
