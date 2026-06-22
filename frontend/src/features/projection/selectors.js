export function selectVisibleInstruments(state) {
  return Object.values(state.instruments).filter((instrument) => instrument.visible !== false).sort((a, b) => String(a.orderKey).localeCompare(String(b.orderKey)));
}

function cardIdForEntity(entity) {
  return entity?.cardId ?? entity?.appearanceId ?? entity?.holeId ?? entity?.id ?? null;
}

function decorateWithLayout(card, layoutByCardId) {
  const cardId = cardIdForEntity(card);
  const layout = layoutByCardId?.[cardId];
  if (!layout) return card;
  return {
    ...card,
    resolvedRow: layout.resolvedRow,
    visualIndex: layout.visualIndex,
    cardIndexInColumn: layout.cardIndexInColumn,
  };
}

function compareCardsByLayout(layoutByCardId = {}) {
  return (a, b) => {
    const aLayout = layoutByCardId[cardIdForEntity(a)];
    const bLayout = layoutByCardId[cardIdForEntity(b)];
    const visual = (aLayout?.visualIndex ?? Number.MAX_SAFE_INTEGER) - (bLayout?.visualIndex ?? Number.MAX_SAFE_INTEGER);
    if (visual !== 0) return visual;
    const row = (aLayout?.resolvedRow ?? Number.MAX_SAFE_INTEGER) - (bLayout?.resolvedRow ?? Number.MAX_SAFE_INTEGER);
    if (row !== 0) return row;
    const column = (aLayout?.cardIndexInColumn ?? Number.MAX_SAFE_INTEGER) - (bLayout?.cardIndexInColumn ?? Number.MAX_SAFE_INTEGER);
    if (column !== 0) return column;
    return String(cardIdForEntity(a)).localeCompare(String(cardIdForEntity(b)));
  };
}

export function selectCardsForInstrument(state, instrumentId, layoutByCardId = state.layoutByCardId) {
  return [
    ...Object.values(state.appearances).filter((appearance) => appearance.instrumentId === instrumentId && appearance.status !== 'removed'),
    ...Object.values(state.holes).filter((hole) => hole.instrumentId === instrumentId && hole.status !== 'removed'),
  ]
    .map((card) => decorateWithLayout(card, layoutByCardId))
    .sort(compareCardsByLayout(layoutByCardId));
}

export function selectReplacementCandidates(state, instrumentId) {
  return selectCardsForInstrument(state, instrumentId).filter((card) => card.type === 'appearance' && !card.played && !card.locked);
}

export function buildColumns(state, layoutByCardId = state.layoutByCardId, visibleResolvedRows = state.visibleResolvedRows) {
  const rows = [...(visibleResolvedRows ?? [])].sort((a, b) => a - b);
  return selectVisibleInstruments(state).map((instrument) => {
    const cards = selectCardsForInstrument(state, instrument.instrumentId, layoutByCardId);
    const cardByResolvedRow = new Map(
      cards.map((card) => [layoutByCardId?.[cardIdForEntity(card)]?.resolvedRow, card]),
    );
    return {
      instrument,
      visibleRoundCount: state.visibleRoundsByInstrument[instrument.instrumentId] ?? 1,
      visibleResolvedRows: rows,
      cards,
      rows: rows.map((resolvedRow, index) => {
        const card = cardByResolvedRow.get(resolvedRow) ?? null;
        return {
          visualIndex: index + 1,
          resolvedRow,
          cardId: card ? cardIdForEntity(card) : null,
          card,
          isVisualEmptyCell: !card,
        };
      }),
    };
  });
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
