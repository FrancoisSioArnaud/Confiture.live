export function applyEvent(state, event) {
  const p = event.payload ?? {};
  switch (event.type) {
    case 'jam_created': state.jam = { jamId: p.jamId, name: p.name, indicativeDate: p.indicativeDate, status: 'active', linkReorderStrategy: p.linkReorderStrategy ?? 'move_to_first' }; break;
    case 'jam_metadata_updated': state.jam = { ...state.jam, ...p }; break;
    case 'instrument_added': state.instruments[p.instrumentId] = { instrumentId: p.instrumentId, name: p.name, isVisible: p.isVisible ?? true, order: p.order ?? state.instrumentOrder.length }; if (!state.instrumentOrder.includes(p.instrumentId)) state.instrumentOrder.push(p.instrumentId); break;
    case 'instrument_visibility_changed': if (state.instruments[p.instrumentId]) state.instruments[p.instrumentId].isVisible = p.isVisible; break;
    case 'participant_created': state.participants[p.participantId] = { participantId: p.participantId, name: p.name, presenceStatus: p.presenceStatus ?? 'available' }; break;
    case 'participant_updated': state.participants[p.participantId] = { ...state.participants[p.participantId], ...p }; break;
    case 'participant_left': if (state.participants[p.participantId]) state.participants[p.participantId].presenceStatus = 'left'; break;
    case 'participation_added': state.participations[p.participationId] = { participationId: p.participationId, participantId: p.participantId, instrumentId: p.instrumentId, baseOrderKey: p.baseOrderKey ?? p.participationId, removed: false }; break;
    case 'participation_removed': if (state.participations[p.participationId]) state.participations[p.participationId].removed = true; break;
    case 'appearance_materialized': state.appearances[p.appearanceId] = { appearanceId: p.appearanceId, participationId: p.participationId, participantId: p.participantId, instrumentId: p.instrumentId, appearanceIndex: p.appearanceIndex, orderKey: p.orderKey ?? `${p.appearanceIndex}:${p.appearanceId}`, deleted: false }; break;
    case 'appearance_reordered': if (state.appearances[p.appearanceId]) state.appearances[p.appearanceId].orderKey = p.orderKey; break;
    case 'appearance_deleted': if (state.appearances[p.appearanceId]) state.appearances[p.appearanceId].deleted = true; break;
    case 'hole_added': state.holes[p.holeId] = { holeId: p.holeId, instrumentId: p.instrumentId, appearanceIndex: p.appearanceIndex ?? 1, orderKey: p.orderKey ?? `hole:${p.holeId}`, deleted: false }; break;
    case 'hole_removed': if (state.holes[p.holeId]) state.holes[p.holeId].deleted = true; Object.values(state.links).forEach((l) => { l.removed ||= l.targets?.some((t) => t.targetType === 'hole' && t.targetId === p.holeId); }); break;
    case 'link_created': state.links[p.linkId] = { linkId: p.linkId, targets: p.targets ?? [], removed: false }; break;
    case 'link_removed': if (state.links[p.linkId]) state.links[p.linkId].removed = true; break;
    case 'conflict_created': state.conflicts[p.conflictId] = { ...p, removed: false }; break;
    case 'conflict_removed': if (state.conflicts[p.conflictId]) state.conflicts[p.conflictId].removed = true; break;
    case 'lock_added': state.locks[p.lockId] = { ...p, removed: false }; break;
    case 'lock_removed': if (state.locks[p.lockId]) state.locks[p.lockId].removed = true; break;
    case 'plateau_played': state.playedPlateaus.push({ plateauId: p.plateauId, targets: p.targets ?? [] }); break;
    case 'transaction_reverted': state.revertedTransactionIds.push(p.transactionId); break;
  }
  return state;
}
