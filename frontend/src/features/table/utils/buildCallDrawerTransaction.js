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

function adjacentAt(column, index) {
  return {
    afterCard: column?.cards[index - 1] ?? null,
    beforeCard: column?.cards[index + 1] ?? null,
  };
}

function linkIdsForCards(cards, projection) {
  return [...new Set(cards.flatMap((card) => cardLinks(card, projection.links).map((link) => link.linkId)))];
}

export function replacementCandidatesForCallDrawer({ projection, sourceCard, plateauIndex }) {
  const column = columnForCard(projection, sourceCard);
  if (!column) return [];
  return column.cards
    .filter((card, index) => (
      card.type === 'appearance'
      && card.id !== sourceCard.id
      && index > plateauIndex
      && !card.played
      && !card.locked
      && projection.participants[card.participantId]?.status !== 'left'
      && projection.participants[card.participantId]?.status !== 'removed'
    ))
    .slice(0, 3);
}

export function buildSkipWithReplacementTransaction({ jamId, clientId, clientSequenceNumber, projection, sourceCard, replacementCard, plateauIndex, confirmedDelink = false }) {
  const sourceColumn = columnForCard(projection, sourceCard);
  const replacementColumn = columnForCard(projection, replacementCard);
  const sourceIndex = sourceColumn.cards.findIndex((card) => card.id === sourceCard.id);
  const replacementIndex = replacementColumn.cards.findIndex((card) => card.id === replacementCard.id);
  const sourceAdjacent = adjacentAt(sourceColumn, sourceIndex);
  const replacementAdjacent = adjacentAt(replacementColumn, replacementIndex);
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
        originalPlateauIndex: plateauIndex,
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

export function buildSkipWithoutMusicianTransaction({ jamId, clientId, clientSequenceNumber, projection, sourceCard, plateauIndex, confirmedDelink = false }) {
  const sourceColumn = columnForCard(projection, sourceCard);
  const sourceIndex = sourceColumn.cards.findIndex((card) => card.id === sourceCard.id);
  const sourceAdjacent = adjacentAt(sourceColumn, sourceIndex);
  const holeId = createId('hole');
  const removedLinkIds = linkIdsForCards([sourceCard], projection);

  return createTransaction({
    jamId,
    clientId,
    clientSequenceNumber,
    label: 'Faire sans musicien',
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
      }),
      appearanceSkipped({
        appearanceId: sourceCard.id,
        instrumentId: sourceCard.instrumentId,
        originalPlateauIndex: plateauIndex,
        replacement: { mode: 'hole', holeId },
        createdHoleId: holeId,
        removedLinkIds,
        confirmedDelink,
      }),
      appearanceMovedBetween({
        appearanceId: sourceCard.id,
        instrumentId: sourceCard.instrumentId,
        afterTarget: toTarget(sourceCard),
        beforeTarget: toTarget(sourceAdjacent.beforeCard),
        movedLinkedGroup: false,
      }),
    ],
  });
}
