import { holeAdded, linkCreated } from '../../transactions/eventFactories';
import { createTransaction } from '../../transactions/createTransaction';
import { createId } from '../../../shared/utils/createId';

function toTarget(card) {
  if (!card) return null;
  return { type: card.type, id: card.id };
}

function insertionForInstrument(projection, instrumentId, appearanceIndex) {
  const column = (projection.columns ?? []).find((candidate) => candidate.instrument.instrumentId === instrumentId);
  const cards = column?.cards ?? [];
  const beforeIndex = cards.findIndex((card) => card.appearanceIndex >= appearanceIndex);
  if (beforeIndex < 0) return { afterCard: cards.at(-1) ?? null, beforeCard: null };
  return { afterCard: cards[beforeIndex - 1] ?? null, beforeCard: cards[beforeIndex] ?? null };
}

export function buildPlayWithoutTransaction({ jamId, clientId, clientSequenceNumber, projection, sourceCard, instrumentIds }) {
  const events = [];
  const holeTargets = instrumentIds.map((instrumentId) => {
    const holeId = createId('hole');
    const { afterCard, beforeCard } = insertionForInstrument(projection, instrumentId, sourceCard.appearanceIndex);
    events.push(holeAdded({
      holeId,
      instrumentId,
      appearanceIndex: sourceCard.appearanceIndex,
      reason: 'play_without',
      afterTarget: toTarget(afterCard),
      beforeTarget: toTarget(beforeCard),
      positionKey: `position_${holeId}`,
    }));
    return { type: 'hole', id: holeId };
  });
  if (holeTargets.length > 0) {
    events.push(linkCreated({
      linkId: createId('link'),
      targets: [{ type: 'appearance', id: sourceCard.id }, ...holeTargets],
      reorderStrategy: projection.jam?.linkReorderStrategy ?? 'move_to_first',
    }));
  }
  if (events.length === 0) return null;
  return createTransaction({ jamId, clientId, clientSequenceNumber, label: 'Jouer sans musicien', events });
}
