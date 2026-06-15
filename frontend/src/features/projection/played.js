export function isPlayed(state, target) {
  const entity = target.type === 'appearance' ? state.appearances[target.id] : state.holes[target.id];
  return Boolean(entity?.played);
}

export function setPlayed(state, target, played, plateauIndex = null) {
  const entity = target.type === 'appearance' ? state.appearances[target.id] : state.holes[target.id];
  if (entity) entity.played = played;
  if (plateauIndex != null) {
    if (played) state.playedPlateaux[plateauIndex] = true;
    else delete state.playedPlateaux[plateauIndex];
  }
}
