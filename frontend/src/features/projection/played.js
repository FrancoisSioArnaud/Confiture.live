export function isPlayed(state, target) {
  const entity = target.type === 'appearance' ? state.appearances[target.id] : state.holes[target.id];
  return Boolean(entity?.played);
}

export function playedRowFromPayload(payload = {}) {
  return payload.playedResolvedRow ?? payload.targetResolvedRow ?? null;
}

export function setPlayed(state, target, played, resolvedRow = null) {
  const entity = target.type === 'appearance' ? state.appearances[target.id] : state.holes[target.id];
  if (entity) {
    entity.played = played;
    if (Number.isFinite(resolvedRow)) {
      if (played) entity.playedResolvedRow = resolvedRow;
      else if (entity.playedResolvedRow === resolvedRow) delete entity.playedResolvedRow;
    }
  }
  if (Number.isFinite(resolvedRow)) {
    state.playedRows ??= {};
    state.playedPlateaux ??= {};
    if (played) {
      state.playedRows[resolvedRow] = true;
      state.playedPlateaux[resolvedRow] = true;
    } else {
      delete state.playedRows[resolvedRow];
      delete state.playedPlateaux[resolvedRow];
    }
  }
}

export function targetsPlayedAtResolvedRow(state, resolvedRow) {
  return [
    ...Object.values(state.appearances ?? {}),
    ...Object.values(state.holes ?? {}),
  ].filter((entity) => entity.played && entity.playedResolvedRow === resolvedRow);
}
