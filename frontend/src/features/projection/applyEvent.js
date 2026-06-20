import { addConflict, removeConflict } from './conflicts';
import { addHole, getTargetEntity } from './holes';
import { addLink, removeLink } from './links';
import { setLock } from './locks';
import { stableOrderValue } from './ordering';
import { setPlayed } from './played';
import { addProjectionWarning } from './projectionWarnings';
import { ensureVisibleRoundCount } from './rounds';

export function applyEvent(state, event) {
  const payload = event.payload ?? {};
  switch (event.type) {
    case 'jam_created':
      state.jam = { jamId: payload.jamId, name: payload.name, indicativeDate: payload.indicativeDate, status: 'active', linkReorderStrategy: payload.linkReorderStrategy };
      break;
    case 'jam_updated':
      state.jam = { ...(state.jam ?? {}), ...payload };
      break;
    case 'jam_link_reorder_strategy_changed':
      state.jam = { ...(state.jam ?? {}), linkReorderStrategy: payload.nextStrategy };
      break;
    case 'instrument_added':
      state.instruments[payload.instrumentId] = { id: payload.instrumentId, ...payload, status: 'active' };
      ensureVisibleRoundCount(state, payload.instrumentId);
      break;
    case 'instrument_updated':
      if (state.instruments[payload.instrumentId]) state.instruments[payload.instrumentId] = { ...state.instruments[payload.instrumentId], ...payload };
      else addProjectionWarning(state, 'missing_instrument', 'instrument_updated targets a missing instrument.', payload);
      break;
    case 'instruments_reordered':
      payload.orderedInstrumentIds.forEach((instrumentId, index) => {
        if (state.instruments[instrumentId]) state.instruments[instrumentId].orderKey = `order_${index}`;
      });
      break;
    case 'instrument_visibility_changed':
      if (state.instruments[payload.instrumentId]) state.instruments[payload.instrumentId].visible = payload.visible;
      else addProjectionWarning(state, 'missing_instrument', 'instrument_visibility_changed targets a missing instrument.', payload);
      break;
    case 'instrument_round_visibility_changed':
      state.visibleRoundsByInstrument[payload.instrumentId] = payload.visibleRoundCount;
      break;
    case 'participant_created':
      state.participants[payload.participantId] = { id: payload.participantId, participantId: payload.participantId, name: payload.name, status: 'active', createdAtEventId: event.eventId, removedAtEventId: null };
      break;
    case 'participant_updated':
      if (state.participants[payload.participantId]) state.participants[payload.participantId].name = payload.name;
      else addProjectionWarning(state, 'missing_participant', 'participant_updated targets a missing participant.', payload);
      break;
    case 'participant_removed':
      markParticipant(state, payload.participantId, 'removed', event.eventId);
      break;
    case 'participant_marked_left':
      markParticipant(state, payload.participantId, 'left', event.eventId);
      break;
    case 'participation_added':
      state.participations[payload.participationId] = { id: payload.participationId, ...payload, status: 'active' };
      ensureVisibleRoundCount(state, payload.instrumentId);
      break;
    case 'participation_removed':
      if (state.participations[payload.participationId]) state.participations[payload.participationId].status = 'removed';
      else addProjectionWarning(state, 'missing_participation', 'participation_removed targets a missing participation.', payload);
      break;
    case 'appearance_materialized': {
      const participation = state.participations[payload.participationId];
      state.appearances[payload.appearanceId] = {
        id: payload.appearanceId,
        type: 'appearance',
        ...state.appearances[payload.appearanceId],
        ...payload,
        participantId: state.appearances[payload.appearanceId]?.participantId ?? participation?.participantId,
        customInstrumentLabel: state.appearances[payload.appearanceId]?.customInstrumentLabel ?? participation?.customInstrumentLabel ?? null,
        status: 'active',
        played: state.appearances[payload.appearanceId]?.played ?? false,
        locked: state.appearances[payload.appearanceId]?.locked ?? false,
        materialized: true,
        positionInRound: state.appearances[payload.appearanceId]?.positionInRound ?? stableOrderValue(payload.positionKey),
        roundOrder: state.appearances[payload.appearanceId]?.roundOrder ?? stableOrderValue(payload.positionKey),
        orderScore: state.appearances[payload.appearanceId]?.orderScore ?? (payload.appearanceIndex * 1_000_000 + stableOrderValue(payload.positionKey)),
      };
      break;
    }
    case 'appearance_moved_between':
      recordManualMoveIntent(state, event, { type: 'appearance', id: payload.appearanceId }, payload);
      break;
    case 'appearance_removed':
      removeAppearance(state, payload.appearanceId, payload);
      break;
    case 'appearance_locked':
      setLock(state, { type: 'appearance', id: payload.appearanceId }, true);
      if (state.appearances[payload.appearanceId]) state.appearances[payload.appearanceId].locked = true;
      break;
    case 'appearance_unlocked':
      setLock(state, { type: 'appearance', id: payload.appearanceId }, false);
      if (state.appearances[payload.appearanceId]) state.appearances[payload.appearanceId].locked = false;
      break;
    case 'appearance_skipped':
      if (state.appearances[payload.appearanceId]) state.appearances[payload.appearanceId].skippedAtPlateauIndex = payload.originalPlateauIndex;
      payload.removedLinkIds?.forEach((linkId) => removeLink(state, linkId));
      break;
    case 'hole_added':
      addHole(state, payload);
      break;
    case 'hole_removed':
      if (state.holes[payload.holeId]) {
        state.holes[payload.holeId].status = 'removed';
        removeLinksTargeting(state, { type: 'hole', id: payload.holeId });
      } else addProjectionWarning(state, 'missing_hole', 'hole_removed targets a missing hole.', payload);
      break;
    case 'hole_moved_between':
      recordManualMoveIntent(state, event, { type: 'hole', id: payload.holeId }, payload);
      break;
    case 'hole_locked':
      setLock(state, { type: 'hole', id: payload.holeId }, true);
      if (state.holes[payload.holeId]) state.holes[payload.holeId].locked = true;
      break;
    case 'hole_unlocked':
      setLock(state, { type: 'hole', id: payload.holeId }, false);
      if (state.holes[payload.holeId]) state.holes[payload.holeId].locked = false;
      break;
    case 'link_created':
      addLink(state, payload);
      break;
    case 'link_removed':
      removeLink(state, payload.linkId);
      break;
    case 'conflict_created':
      addConflict(state, payload);
      break;
    case 'conflict_removed':
      removeConflict(state, payload.conflictId);
      break;
    case 'plateau_played':
      payload.targets.forEach((target) => setPlayed(state, target, true, payload.plateauIndex));
      break;
    case 'plateau_unplayed': {
      const lastPlayedPlateau = Math.max(...Object.keys(state.playedPlateaux).map(Number));
      if (payload.plateauIndex === lastPlayedPlateau) payload.targets.forEach((target) => setPlayed(state, target, false, payload.plateauIndex));
      else addProjectionWarning(state, 'non_last_plateau_unplayed_ignored', 'plateau_unplayed ignored because only the latest played plateau can be unplayed in V0.', payload);
      break;
    }
    case 'transaction_reverted':
    case 'transaction_redone':
      break;
    default:
      addProjectionWarning(state, 'unknown_event_type', `Unknown event type ${event.type}.`, { event });
  }
}

function removeLinksTargeting(state, target) {
  Object.values(state.links).forEach((link) => {
    if (link.status === 'active' && link.targets.some((candidate) => candidate.type === target.type && candidate.id === target.id)) {
      link.status = 'removed';
    }
  });
}


function removeConflictsTargeting(state, targetIds) {
  Object.values(state.conflicts).forEach((conflict) => {
    if (conflict.status === 'active' && conflict.targetIds.some((targetId) => targetIds.includes(targetId))) {
      conflict.status = 'removed';
    }
  });
}

function parseCalculatedAppearanceId(appearanceId) {
  const match = String(appearanceId).match(/^appearance_(.+)_(\d+)$/);
  if (!match) return null;
  return { participationId: match[1], appearanceIndex: Number(match[2]) };
}

function removeAppearance(state, appearanceId, payload = {}) {
  const existing = state.appearances[appearanceId];
  if (existing) {
    existing.status = 'removed';
    removeLinksTargeting(state, { type: 'appearance', id: appearanceId });
    removeConflictsTargeting(state, [appearanceId, existing.participationId].filter(Boolean));
    return;
  }

  const parsed = parseCalculatedAppearanceId(appearanceId);
  const participation = parsed ? state.participations[parsed.participationId] : null;
  if (!participation) {
    addProjectionWarning(state, 'missing_appearance', 'appearance_removed targets a missing appearance.', payload);
    return;
  }

  state.appearances[appearanceId] = {
    id: appearanceId,
    appearanceId,
    type: 'appearance',
    participationId: participation.participationId,
    participantId: participation.participantId,
    instrumentId: participation.instrumentId,
    appearanceIndex: parsed.appearanceIndex,
    status: 'removed',
    played: false,
    locked: false,
    materialized: true,
    positionKey: `${participation.baseOrderKey}:${parsed.appearanceIndex}`,
    positionInRound: stableOrderValue(participation.baseOrderKey),
    roundOrder: stableOrderValue(participation.baseOrderKey),
  };
  removeLinksTargeting(state, { type: 'appearance', id: appearanceId });
  removeConflictsTargeting(state, [appearanceId, participation.participationId].filter(Boolean));
}

function markParticipant(state, participantId, status, eventId) {
  const participant = state.participants[participantId];
  if (!participant) {
    addProjectionWarning(state, 'missing_participant', `${status} targets a missing participant.`, { participantId });
    return;
  }
  participant.status = status;
  participant.removedAtEventId = eventId;
  Object.values(state.participations).forEach((participation) => {
    if (participation.participantId === participantId && status === 'removed') participation.status = 'removed';
  });
  Object.values(state.appearances).forEach((appearance) => {
    if (appearance.participantId === participantId || state.participations[appearance.participationId]?.participantId === participantId) {
      if (status === 'removed' || !appearance.played) {
        appearance.status = 'removed';
        removeLinksTargeting(state, { type: 'appearance', id: appearance.appearanceId ?? appearance.id });
        removeConflictsTargeting(state, [appearance.appearanceId ?? appearance.id, appearance.participationId].filter(Boolean));
      }
    }
  });
}

function recordManualMoveIntent(state, event, target, payload) {
  const entity = getTargetEntity(state, target);
  if (!entity) {
    addProjectionWarning(state, 'missing_target', 'move targets a missing card.', { target, payload });
    return;
  }
  entity.manualOrderHint = {
    target: { ...target },
    afterTarget: payload.afterTarget ? { ...payload.afterTarget } : null,
    beforeTarget: payload.beforeTarget ? { ...payload.beforeTarget } : null,
    transactionId: event.transactionId ?? null,
    eventId: event.eventId ?? null,
    eventIndexInTransaction: event.eventIndexInTransaction ?? 0,
  };
}
