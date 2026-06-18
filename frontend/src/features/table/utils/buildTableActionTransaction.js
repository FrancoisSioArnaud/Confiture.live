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

function inferAppearanceIndexForPlateau(projection, plateauIndex) {
  const rowCards = (projection?.columns ?? [])
    .map((column) => column.cards?.[plateauIndex])
    .filter(Boolean);
  const firstRoundCard = rowCards.find((card) => Number.isFinite(card.appearanceIndex));
  return firstRoundCard?.appearanceIndex ?? 1;
}

function playedEmptySlotHoleEvents({ projection, plateauIndex }) {
  if (!projection) return { events: [], targets: [] };
  const appearanceIndex = inferAppearanceIndexForPlateau(projection, plateauIndex);
  const events = [];
  const targets = [];

  (projection.columns ?? []).forEach((column) => {
    const existing = column.cards?.[plateauIndex];
    if (existing) return;

    const holeId = createId('hole');
    const afterCard = column.cards?.[plateauIndex - 1] ?? null;
    const beforeCard = column.cards?.[plateauIndex] ?? null;
    events.push(holeAdded({
      holeId,
      instrumentId: column.instrument.instrumentId,
      appearanceIndex,
      reason: 'played_empty_slot',
      afterTarget: toTarget(afterCard),
      beforeTarget: toTarget(beforeCard),
      positionKey: `played_empty_slot_${plateauIndex}_${holeId}`,
    }));
    targets.push({ type: 'hole', id: holeId });
  });

  return { events, targets };
}

export function buildTogglePlateauPlayedTransaction({ jamId, clientId, clientSequenceNumber, plateauIndex, targets, played, projection = null }) {
  const emptySlotPatch = played ? { events: [], targets: [] } : playedEmptySlotHoleEvents({ projection, plateauIndex });
  const finalTargets = [...targets, ...emptySlotPatch.targets];
  const event = played
    ? plateauUnplayed({ plateauIndex, targets: finalTargets })
    : plateauPlayed({ plateauIndex, targets: finalTargets, playedAt: new Date().toISOString() });
  return createTransaction({
    jamId,
    clientId,
    clientSequenceNumber,
    label: played ? 'Annuler plateau joué' : 'Marquer plateau joué',
    events: [...emptySlotPatch.events, event],
  });
}
