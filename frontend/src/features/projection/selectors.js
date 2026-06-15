import { sortByColumnOrder } from './ordering';

export function selectVisibleInstruments(state) {
  return Object.values(state.instruments).filter((instrument) => instrument.visible !== false).sort((a, b) => String(a.orderKey).localeCompare(String(b.orderKey)));
}

export function selectCardsForInstrument(state, instrumentId) {
  return [
    ...Object.values(state.appearances).filter((appearance) => appearance.instrumentId === instrumentId && appearance.status !== 'removed'),
    ...Object.values(state.holes).filter((hole) => hole.instrumentId === instrumentId && hole.status !== 'removed'),
  ].sort(sortByColumnOrder);
}

export function selectReplacementCandidates(state, instrumentId) {
  return selectCardsForInstrument(state, instrumentId).filter((card) => card.type === 'appearance' && !card.played && !card.locked);
}

export function buildColumns(state) {
  return selectVisibleInstruments(state).map((instrument) => ({
    instrument,
    visibleRoundCount: state.visibleRoundsByInstrument[instrument.instrumentId] ?? 1,
    cards: selectCardsForInstrument(state, instrument.instrumentId),
  }));
}

export function buildCountersByInstrument(state) {
  return Object.fromEntries(Object.values(state.instruments).map((instrument) => {
    const cards = selectCardsForInstrument(state, instrument.instrumentId);
    const firstAppearancesByParticipant = new Map();
    cards.filter((card) => card.type === 'appearance').forEach((card) => {
      const existing = firstAppearancesByParticipant.get(card.participantId);
      if (!existing || card.appearanceIndex < existing.appearanceIndex) firstAppearancesByParticipant.set(card.participantId, card);
    });
    return [instrument.instrumentId, {
      appearances: cards.filter((card) => card.type === 'appearance').length,
      holes: cards.filter((card) => card.type === 'hole').length,
      played: cards.filter((card) => card.played).length,
      locked: cards.filter((card) => card.locked).length,
      notYetPlayedFirstTime: [...firstAppearancesByParticipant.values()].filter((card) => !card.played).length,
    }];
  }));
}

export function buildCallDrawerSelectors(state) {
  return {
    currentPlateau: null,
    replacementCandidatesByInstrument: Object.fromEntries(Object.keys(state.instruments).map((instrumentId) => [instrumentId, selectReplacementCandidates(state, instrumentId)])),
  };
}
