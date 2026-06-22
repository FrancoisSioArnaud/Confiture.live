import {
  holeAdded,
  instrumentRoundVisibilityChanged,
  plateauPlayed,
  plateauUnplayed,
} from '../../transactions/eventFactories';
import { createTransaction } from '../../transactions/createTransaction';
import { createId } from '../../../shared/utils/createId';

export function buildRevealRoundTransaction({ jamId, clientId, clientSequenceNumber, instrumentId, visibleRoundCount }) {
  return createTransaction({
    jamId,
    clientId,
    clientSequenceNumber,
    label: 'Afficher le round suivant',
    events: [instrumentRoundVisibilityChanged({ instrumentId, visibleRoundCount })],
  });
}

function toTarget(card) {
  return card ? { type: card.type, id: card.id } : null;
}

function cardResolvedRow(card) {
  return card?.resolvedRow ?? null;
}

function visualIndexToResolvedRow(projection, visualIndex, plateauIndex) {
  const fromVisibleRows = projection?.visibleResolvedRows?.[visualIndex - 1];
  if (Number.isFinite(fromVisibleRows)) return fromVisibleRows;
  const cards = (projection?.columns ?? []).flatMap((column) => column.cards ?? []);
  const fromCard = cards.find((card) => card.visualIndex === visualIndex)?.resolvedRow;
  if (Number.isFinite(fromCard)) return fromCard;
  return (plateauIndex ?? 0) + 1;
}

function cardsAtResolvedRow(projection, resolvedRow) {
  return (projection?.columns ?? []).flatMap((column) =>
    (column.cards ?? []).filter((card) => cardResolvedRow(card) === resolvedRow),
  );
}

function cardAtResolvedRow(column, resolvedRow) {
  return (column.cards ?? []).find((card) => cardResolvedRow(card) === resolvedRow) ?? null;
}

function inferAppearanceIndexForResolvedRow(projection, resolvedRow) {
  const rowCards = cardsAtResolvedRow(projection, resolvedRow);
  const firstRoundCard = rowCards.find((card) => Number.isFinite(card.appearanceIndex));
  return firstRoundCard?.appearanceIndex ?? 1;
}

function playedEmptySlotHoleEvents({ projection, resolvedRow, visualIndex }) {
  if (!projection) return { events: [], targets: [] };
  const appearanceIndex = inferAppearanceIndexForResolvedRow(projection, resolvedRow);
  const events = [];
  const targets = [];

  (projection.columns ?? []).forEach((column) => {
    const existing = cardAtResolvedRow(column, resolvedRow);
    if (existing) return;

    const holeId = createId('hole');
    const previousInColumn = (column.cards ?? [])
      .filter((card) => cardResolvedRow(card) < resolvedRow)
      .sort((a, b) => cardResolvedRow(b) - cardResolvedRow(a))[0] ?? null;
    const nextInColumn = (column.cards ?? [])
      .filter((card) => cardResolvedRow(card) > resolvedRow)
      .sort((a, b) => cardResolvedRow(a) - cardResolvedRow(b))[0] ?? null;
    events.push(holeAdded({
      holeId,
      instrumentId: column.instrument.instrumentId,
      appearanceIndex,
      reason: 'played_empty_slot',
      afterTarget: toTarget(previousInColumn),
      beforeTarget: toTarget(nextInColumn),
      positionKey: `played_empty_slot_${visualIndex}_${holeId}`,
      preferredResolvedRow: resolvedRow,
      targetResolvedRow: resolvedRow,
    }));
    targets.push({ type: 'hole', id: holeId });
  });

  return { events, targets };
}

export function buildTogglePlateauPlayedTransaction({ jamId, clientId, clientSequenceNumber, plateauIndex = 0, visualIndex = plateauIndex + 1, playedResolvedRow = null, targets, played, projection = null }) {
  const resolvedRow = playedResolvedRow ?? visualIndexToResolvedRow(projection, visualIndex, plateauIndex);
  const concreteTargets = targets ?? cardsAtResolvedRow(projection, resolvedRow).map(toTarget).filter(Boolean);
  const emptySlotPatch = played ? { events: [], targets: [] } : playedEmptySlotHoleEvents({ projection, resolvedRow, visualIndex });
  const finalTargets = [...concreteTargets, ...emptySlotPatch.targets];
  const payload = { plateauIndex, visualIndex, playedResolvedRow: resolvedRow, targetResolvedRow: resolvedRow, targets: finalTargets };
  const event = played
    ? plateauUnplayed(payload)
    : plateauPlayed({ ...payload, playedAt: new Date().toISOString() });
  return createTransaction({
    jamId,
    clientId,
    clientSequenceNumber,
    label: played ? 'Annuler plateau joué' : 'Marquer plateau joué',
    events: [...emptySlotPatch.events, event],
  });
}
