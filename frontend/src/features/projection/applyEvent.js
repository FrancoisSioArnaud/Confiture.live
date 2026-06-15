import { removeLinksTargeting, validateLink } from './links.js';
import { targetTransactionIdFromRevert } from './undo.js';

function target(type, id) {
  return { type, id };
}

function setLock(state, lockId, targetType, targetId, locked) {
  if (!lockId || !targetType || !targetId) return;
  state.locks[lockId] = { lockId, targetType, targetId, removed: !locked };
}

function setPlayedTargets(state, targets, played) {
  for (const playedTarget of targets ?? []) {
    const type = playedTarget.type ?? playedTarget.targetType;
    const id = playedTarget.id ?? playedTarget.targetId;
    if (!type || !id) continue;
    state.playedTargets[`${type}:${id}`] = played;
  }
}


function isTargetLocked(state, targetType, targetId) {
  return Object.values(state.locks).some((lock) => !lock.removed && lock.targetType === targetType && lock.targetId === targetId);
}

function isTargetPlayed(state, targetType, targetId) {
  return Boolean(state.playedTargets[`${targetType}:${targetId}`]);
}

function canMoveTarget(state, targetType, targetId, event) {
  if (isTargetLocked(state, targetType, targetId)) {
    state.projectionWarnings.push({ type: 'move_ignored_locked_target', eventId: event.eventId, targetType, targetId });
    return false;
  }
  if (isTargetPlayed(state, targetType, targetId)) {
    state.projectionWarnings.push({ type: 'move_ignored_played_target', eventId: event.eventId, targetType, targetId });
    return false;
  }
  return true;
}

function applyPositionPayload(entity, payload, event) {
  entity.positionKey = payload.positionKey ?? payload.orderKey ?? payload.toOrderKey ?? entity.positionKey;
  entity.orderKey = payload.positionKey ?? payload.orderKey ?? payload.toOrderKey ?? entity.orderKey;
  entity.lastMovedSequenceNumber = event.serverSequenceNumber ?? event.clientSequenceNumber ?? event.localSequenceNumber ?? 0;
  entity.afterTarget = payload.afterTarget ?? entity.afterTarget;
  entity.beforeTarget = payload.beforeTarget ?? entity.beforeTarget;
}

export function applyEvent(state, event) {
  const p = event.payload ?? {};
  switch (event.type) {
    case 'jam_created':
      state.jam = { jamId: p.jamId, name: p.name, indicativeDate: p.indicativeDate, status: 'active', linkReorderStrategy: p.linkReorderStrategy ?? 'move_to_first' };
      break;
    case 'jam_updated':
      state.jam = { ...state.jam, name: p.name ?? state.jam?.name, indicativeDate: p.indicativeDate ?? state.jam?.indicativeDate };
      break;
    case 'jam_link_reorder_strategy_changed':
      state.jam = { ...state.jam, linkReorderStrategy: p.nextStrategy ?? p.linkReorderStrategy ?? state.jam?.linkReorderStrategy };
      break;
    case 'instrument_added':
      state.instruments[p.instrumentId] = { instrumentId: p.instrumentId, name: p.name ?? p.label, isVisible: p.visible ?? p.isVisible ?? true, visibleRoundCount: p.visibleRoundCount ?? 1, order: p.order ?? state.instrumentOrder.length };
      if (!state.instrumentOrder.includes(p.instrumentId)) state.instrumentOrder.push(p.instrumentId);
      break;
    case 'instrument_updated':
      state.instruments[p.instrumentId] = { ...state.instruments[p.instrumentId], ...p, name: p.name ?? p.label ?? state.instruments[p.instrumentId]?.name };
      break;
    case 'instruments_reordered': {
      const orderedInstrumentIds = p.orderedInstrumentIds ?? p.instrumentIds ?? p.instrumentOrder ?? [];
      state.instrumentOrder = [...orderedInstrumentIds];
      state.instrumentOrder.forEach((instrumentId, order) => {
        if (state.instruments[instrumentId]) state.instruments[instrumentId].order = order;
      });
      break;
    }
    case 'instrument_visibility_changed':
      if (state.instruments[p.instrumentId]) state.instruments[p.instrumentId].isVisible = p.visible ?? p.isVisible;
      break;
    case 'instrument_round_visibility_changed':
      if (state.instruments[p.instrumentId]) state.instruments[p.instrumentId].visibleRoundCount = p.visibleRoundCount;
      break;
    case 'participant_created':
      state.participants[p.participantId] = { participantId: p.participantId, name: p.name, presenceStatus: p.presenceStatus ?? 'available', removed: false };
      break;
    case 'participant_updated':
      state.participants[p.participantId] = { ...state.participants[p.participantId], ...p };
      break;
    case 'participant_removed':
      if (state.participants[p.participantId]) state.participants[p.participantId].removed = true;
      break;
    case 'participant_marked_left':
      if (state.participants[p.participantId]) state.participants[p.participantId].presenceStatus = 'left';
      break;
    case 'participation_added':
      state.participations[p.participationId] = { participationId: p.participationId, participantId: p.participantId, instrumentId: p.instrumentId, customInstrumentLabel: p.customInstrumentLabel ?? null, insertionMode: p.insertionMode ?? 'end_of_visible_rounds', startAppearanceIndex: p.startAppearanceIndex ?? 1, baseOrderKey: p.baseOrderKey ?? p.positionKey ?? p.participationId, afterTarget: p.afterTarget ?? null, beforeTarget: p.beforeTarget ?? null, removed: false };
      break;
    case 'participation_removed':
      if (state.participations[p.participationId]) state.participations[p.participationId].removed = true;
      break;
    case 'appearance_materialized':
      state.appearances[p.appearanceId] = { appearanceId: p.appearanceId, participationId: p.participationId, participantId: p.participantId, instrumentId: p.instrumentId, appearanceIndex: p.appearanceIndex, positionKey: p.positionKey ?? p.orderKey ?? `${p.appearanceIndex}:${p.appearanceId}`, orderKey: p.positionKey ?? p.orderKey ?? `${p.appearanceIndex}:${p.appearanceId}`, removed: false, skipped: false };
      break;
    case 'appearance_moved_between':
      if (state.appearances[p.appearanceId] && canMoveTarget(state, 'appearance', p.appearanceId, event)) applyPositionPayload(state.appearances[p.appearanceId], p, event);
      break;
    case 'appearance_removed':
      if (state.appearances[p.appearanceId]) state.appearances[p.appearanceId].removed = true;
      removeLinksTargeting(state, target('appearance', p.appearanceId));
      break;
    case 'appearance_skipped':
      if (state.appearances[p.appearanceId]) {
        state.appearances[p.appearanceId].skipped = true;
        state.appearances[p.appearanceId].skipCount = (state.appearances[p.appearanceId].skipCount ?? 0) + 1;
      }
      removeLinksTargeting(state, target('appearance', p.appearanceId));
      for (const linkId of p.removedLinkIds ?? []) {
        if (state.links[linkId]) state.links[linkId].removed = true;
      }
      break;
    case 'appearance_locked':
      setLock(state, p.lockId ?? `appearance:${p.appearanceId}`, 'appearance', p.appearanceId, true);
      break;
    case 'appearance_unlocked':
      setLock(state, p.lockId ?? `appearance:${p.appearanceId}`, 'appearance', p.appearanceId, false);
      break;
    case 'hole_added':
      state.holes[p.holeId] = { holeId: p.holeId, instrumentId: p.instrumentId, appearanceIndex: p.appearanceIndex ?? 1, reason: p.reason ?? 'manual', positionKey: p.positionKey ?? p.orderKey ?? `hole:${p.holeId}`, orderKey: p.positionKey ?? p.orderKey ?? `hole:${p.holeId}`, afterTarget: p.afterTarget ?? null, beforeTarget: p.beforeTarget ?? null, removed: false };
      break;
    case 'hole_removed':
      if (state.holes[p.holeId]) state.holes[p.holeId].removed = true;
      removeLinksTargeting(state, target('hole', p.holeId));
      break;
    case 'hole_moved_between':
      if (state.holes[p.holeId] && canMoveTarget(state, 'hole', p.holeId, event)) applyPositionPayload(state.holes[p.holeId], p, event);
      break;
    case 'hole_locked':
      setLock(state, p.lockId ?? `hole:${p.holeId}`, 'hole', p.holeId, true);
      break;
    case 'hole_unlocked':
      setLock(state, p.lockId ?? `hole:${p.holeId}`, 'hole', p.holeId, false);
      break;
    case 'link_created': {
      const link = { linkId: p.linkId, targets: p.targets ?? [], anchorTarget: p.anchorTarget ?? null, reorderStrategy: p.reorderStrategy ?? state.jam?.linkReorderStrategy ?? 'move_to_first', removed: false };
      const warnings = validateLink(state, link);
      state.links[p.linkId] = { ...link, removed: warnings.length > 0 };
      state.projectionWarnings.push(...warnings.map((warning) => ({ ...warning, eventId: event.eventId })));
      break;
    }
    case 'link_removed':
      if (state.links[p.linkId]) state.links[p.linkId].removed = true;
      break;
    case 'conflict_created':
      state.conflicts[p.conflictId] = { ...p, removed: false };
      break;
    case 'conflict_removed':
      if (state.conflicts[p.conflictId]) state.conflicts[p.conflictId].removed = true;
      break;
    case 'plateau_played':
      state.playedPlateaus.push({ plateauIndex: p.plateauIndex ?? p.plateauId, plateauId: p.plateauId ?? `plateau:${p.plateauIndex}`, targets: p.targets ?? [], playedAt: p.playedAt ?? null });
      setPlayedTargets(state, p.targets, true);
      break;
    case 'plateau_unplayed': {
      const targetPlateau = p.plateauIndex ?? p.plateauId;
      const lastPlayedPlateau = state.playedPlateaus.at(-1);
      const lastPlayedPlateauKey = lastPlayedPlateau?.plateauIndex ?? lastPlayedPlateau?.plateauId;
      if (!lastPlayedPlateau || targetPlateau !== lastPlayedPlateauKey) {
        state.projectionWarnings.push({ type: 'non_last_plateau_unplayed_ignored', eventId: event.eventId, targetPlateau });
        break;
      }
      state.playedPlateaus.pop();
      setPlayedTargets(state, p.targets ?? lastPlayedPlateau.targets, false);
      break;
    }
    case 'transaction_reverted': {
      const targetTransactionId = targetTransactionIdFromRevert(event);
      if (targetTransactionId && !state.revertedTransactionIds.includes(targetTransactionId)) state.revertedTransactionIds.push(targetTransactionId);
      break;
    }
    default:
      state.projectionWarnings.push({ type: 'unsupported_event_type', eventType: event.type, eventId: event.eventId });
      break;
  }
  return state;
}
