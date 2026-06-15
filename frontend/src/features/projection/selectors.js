import { conflictsForTarget } from './conflicts.js';
import { activeLinksForTarget, isLinked } from './links.js';

export function getParticipant(state, participantId) {
  return state.participants[participantId] ?? null;
}

export function getParticipation(state, participationId) {
  return state.participations[participationId] ?? null;
}

export function getInstrument(state, instrumentId) {
  return state.instruments[instrumentId] ?? null;
}

export function isTargetLocked(state, target) {
  const type = target.type ?? target.targetType;
  const id = target.id ?? target.targetId;
  return Object.values(state.locks).some((lock) => !lock.removed && lock.targetType === type && lock.targetId === id);
}

export function isTargetPlayed(state, target) {
  const type = target.type ?? target.targetType;
  const id = target.id ?? target.targetId;
  return Boolean(state.playedTargets[`${type}:${id}`]);
}

export function decorateCardState(state, item) {
  const target = item.type === 'hole'
    ? { type: 'hole', id: item.holeId }
    : { type: 'appearance', id: item.appearanceId };
  const activeConflicts = item.type === 'hole' ? [] : [
    ...conflictsForTarget(state, { scope: 'appearance', id: item.appearanceId }),
    ...conflictsForTarget(state, { scope: 'participation', id: item.participationId }),
  ].map((conflict) => conflict.conflictId);
  return {
    ...item,
    isLocked: isTargetLocked(state, target),
    isPlayed: isTargetPlayed(state, target),
    isLinked: isLinked(state, target),
    activeLinks: activeLinksForTarget(state, target).map((link) => link.linkId),
    hasConflict: activeConflicts.length > 0,
    activeConflicts,
  };
}
