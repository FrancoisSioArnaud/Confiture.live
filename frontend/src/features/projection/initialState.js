export function createInitialProjectionState(snapshot = null) {
  if (snapshot?.payload?.projection) {
    return structuredClone(snapshot.payload.projection);
  }
  return {
    jam: null,
    instruments: {},
    participants: {},
    participations: {},
    appearances: {},
    holes: {},
    links: {},
    conflicts: {},
    visibleRoundsByInstrument: {},
    playedPlateaux: {},
    locks: {},
    layoutByCardId: {},
    orderedCardIdsByColumnId: {},
    visibleResolvedRows: [],
    resolverDebug: {},
    columns: [],
    callDrawer: { currentPlateau: null, replacementCandidatesByInstrument: {} },
    countersByInstrument: {},
    projectionWarnings: [],
    debugWarnings: [],
  };
}
