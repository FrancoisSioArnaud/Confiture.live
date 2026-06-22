import { appearanceMovedBetween, appearanceSkipped, holeAdded, linkRemoved } from '../../transactions/eventFactories';
import { createTransaction } from '../../transactions/createTransaction';
import { createId } from '../../../shared/utils/createId';
import { cardLinks } from './cardState';

function toTarget(card) {
  if (!card) return null;
  return { type: card.type, id: card.id };
}

function columnForCard(projection, card) {
  return projection.columns.find((column) => column.instrument.instrumentId === card.instrumentId);
}

function cardResolvedRow(card) {
  return card?.resolvedRow ?? card?.visualIndex ?? card?.cardIndexInColumn ?? null;
}

function adjacentAroundResolvedRow(column, resolvedRow, sourceId = null) {
  const cards = (column?.cards ?? []).filter((card) => card.id !== sourceId);
  return {
    afterCard: cards.filter((card) => cardResolvedRow(card) < resolvedRow).sort((a, b) => cardResolvedRow(b) - cardResolvedRow(a))[0] ?? null,
    beforeCard: cards.filter((card) => cardResolvedRow(card) > resolvedRow).sort((a, b) => cardResolvedRow(a) - cardResolvedRow(b))[0] ?? null,
  };
}

function linkIdsForCards(cards, projection) {
  return [...new Set(cards.flatMap((card) => cardLinks(card, projection.links).map((link) => link.linkId)))];
}

function conflictAppliesToCards(conflict, leftCard, rightCard) {
  if (conflict.status !== 'active' || leftCard.type !== 'appearance' || rightCard.type !== 'appearance') return false;
  const ids = conflict.scope === 'participation' ? [leftCard.participationId, rightCard.participationId] : [leftCard.id, rightCard.id];
  return ids.every((id) => conflict.targetIds?.includes(id));
}

function plateauCardsExceptSource(projection, sourceCard, resolvedRow) {
  return (projection.columns ?? [])
    .flatMap((column) => (column.cards ?? []).filter((card) => cardResolvedRow(card) === resolvedRow))
    .filter((card) => card && card.id !== sourceCard.id && card.instrumentId !== sourceCard.instrumentId);
}

function candidateConflictsWithPlateau(projection, candidate, sourceCard, resolvedRow) {
  const otherCards = plateauCardsExceptSource(projection, sourceCard, resolvedRow);
  return otherCards.some((otherCard) => Object.values(projection.conflicts ?? {}).some((conflict) => conflictAppliesToCards(conflict, candidate, otherCard)));
}

function participantAlreadyPlayed(projection, candidate) {
  return Object.values(projection.appearances ?? {}).some((appearance) => (
    appearance.id !== candidate.id
    && appearance.participantId === candidate.participantId
    && appearance.played
  ));
}

function compareReplacementCandidates(projection) {
  return (left, right) => {
    const leftAlreadyPlayed = participantAlreadyPlayed(projection, left);
    const rightAlreadyPlayed = participantAlreadyPlayed(projection, right);
    if (leftAlreadyPlayed !== rightAlreadyPlayed) return leftAlreadyPlayed ? 1 : -1;
    if (left.appearanceIndex !== right.appearanceIndex) return left.appearanceIndex - right.appearanceIndex;
    return String(left.id).localeCompare(String(right.id));
  };
}

export function replacementCandidatesForCallDrawer({ projection, sourceCard, visualIndex = null, resolvedRow = null, plateauIndex = null }) {
  const column = columnForCard(projection, sourceCard);
  if (!column) return [];
  const targetResolvedRow = resolvedRow ?? cardResolvedRow(sourceCard) ?? ((plateauIndex ?? Math.max(0, (visualIndex ?? 1) - 1)) + 1);
  return column.cards
    .filter((card) => (
      card.type === 'appearance'
      && card.id !== sourceCard.id
      && cardResolvedRow(card) > targetResolvedRow
      && !card.played
      && !card.locked
      && projection.participants[card.participantId]?.status !== 'left'
      && projection.participants[card.participantId]?.status !== 'removed'
      && !candidateConflictsWithPlateau(projection, card, sourceCard, targetResolvedRow)
    ))
    .sort(compareReplacementCandidates(projection))
    .slice(0, 3);
}

export function replacementCandidatePresentation({ projection, candidate, sourceCard }) {
  const linked = cardLinks(candidate, projection.links).length > 0;
  const instrument = projection.instruments?.[candidate.instrumentId]
    ?? projection.columns?.find((column) => column.instrument.instrumentId === candidate.instrumentId)?.instrument;
  return {
    linked,
    instrumentLabel: instrument?.label ?? 'Instrument',
    alreadyPlayed: participantAlreadyPlayed(projection, candidate),
    willMove: candidate.id !== sourceCard?.id,
    roundLabel: `round ${candidate.appearanceIndex}`,
  };
}

export function buildSkipWithReplacementTransaction({ jamId, clientId, clientSequenceNumber, projection, sourceCard, replacementCard, visualIndex = null, resolvedRow = null, plateauIndex = null, confirmedDelink = false }) {
  const sourceColumn = columnForCard(projection, sourceCard);
  const replacementColumn = columnForCard(projection, replacementCard);
  const targetResolvedRow = resolvedRow ?? cardResolvedRow(sourceCard) ?? ((plateauIndex ?? Math.max(0, (visualIndex ?? 1) - 1)) + 1);
  const replacementResolvedRow = cardResolvedRow(replacementCard) ?? targetResolvedRow;
  const sourceAdjacent = adjacentAroundResolvedRow(sourceColumn, targetResolvedRow, sourceCard.id);
  const replacementAdjacent = adjacentAroundResolvedRow(replacementColumn, replacementResolvedRow, replacementCard.id);
  const removedLinkIds = linkIdsForCards([sourceCard, replacementCard], projection);

  return createTransaction({
    jamId,
    clientId,
    clientSequenceNumber,
    label: 'Remplacer musicien introuvable',
    events: [
      ...removedLinkIds.map((linkId) => linkRemoved({ linkId })),
      appearanceMovedBetween({
        appearanceId: replacementCard.id,
        instrumentId: replacementCard.instrumentId,
        afterTarget: toTarget(sourceAdjacent.afterCard),
        beforeTarget: toTarget(sourceCard),
        movedLinkedGroup: false,
      }),
      appearanceSkipped({
        appearanceId: sourceCard.id,
        instrumentId: sourceCard.instrumentId,
        originalPlateauIndex: Math.max(0, (visualIndex ?? targetResolvedRow) - 1),
        replacement: { mode: 'appearance', appearanceId: replacementCard.id },
        createdHoleId: null,
        removedLinkIds,
        confirmedDelink,
      }),
      appearanceMovedBetween({
        appearanceId: sourceCard.id,
        instrumentId: sourceCard.instrumentId,
        afterTarget: toTarget(replacementAdjacent.afterCard),
        beforeTarget: toTarget(replacementAdjacent.beforeCard),
        movedLinkedGroup: false,
      }),
    ],
  });
}

export function buildSkipWithoutMusicianTransaction({ jamId, clientId, clientSequenceNumber, projection, sourceCard, visualIndex = null, resolvedRow = null, plateauIndex = null, confirmedDelink = false, instrumentLabel = null }) {
  const sourceColumn = columnForCard(projection, sourceCard);
  const targetResolvedRow = resolvedRow ?? cardResolvedRow(sourceCard) ?? ((plateauIndex ?? Math.max(0, (visualIndex ?? 1) - 1)) + 1);
  const sourceAdjacent = adjacentAroundResolvedRow(sourceColumn, targetResolvedRow, sourceCard.id);
  const holeId = createId('hole');
  const removedLinkIds = linkIdsForCards([sourceCard], projection);

  return createTransaction({
    jamId,
    clientId,
    clientSequenceNumber,
    label: instrumentLabel ? `Plateau sans ${instrumentLabel}` : 'Plateau sans instrument',
    events: [
      ...removedLinkIds.map((linkId) => linkRemoved({ linkId })),
      holeAdded({
        holeId,
        instrumentId: sourceCard.instrumentId,
        appearanceIndex: sourceCard.appearanceIndex,
        reason: 'call_drawer_without_musician',
        afterTarget: toTarget(sourceAdjacent.afterCard),
        beforeTarget: toTarget(sourceCard),
        positionKey: `position_${holeId}`,
        preferredResolvedRow: targetResolvedRow,
        targetResolvedRow,
      }),
      appearanceSkipped({
        appearanceId: sourceCard.id,
        instrumentId: sourceCard.instrumentId,
        originalPlateauIndex: Math.max(0, (visualIndex ?? targetResolvedRow) - 1),
        replacement: { mode: 'hole', holeId },
        createdHoleId: holeId,
        removedLinkIds,
        confirmedDelink,
      }),
      appearanceMovedBetween({
        appearanceId: sourceCard.id,
        instrumentId: sourceCard.instrumentId,
        afterTarget: { type: 'hole', id: holeId },
        beforeTarget: toTarget(sourceAdjacent.beforeCard),
        movedLinkedGroup: false,
      }),
    ],
  });
}
