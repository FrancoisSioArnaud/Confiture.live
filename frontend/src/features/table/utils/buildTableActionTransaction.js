import {
  holeAdded,
  instrumentRoundVisibilityChanged,
  participantCreated,
  participationAdded,
  plateauPlayed,
  plateauUnplayed,
} from '../../transactions/eventFactories';
import { createTransaction } from '../../transactions/createTransaction';
import { createId } from '../../../shared/utils/createId';

function toTarget(card) {
  if (!card) return null;
  return { type: card.type, id: card.id };
}

export function buildRevealRoundTransaction({ jamId, clientId, clientSequenceNumber, instrumentId, visibleRoundCount }) {
  return createTransaction({
    jamId,
    clientId,
    clientSequenceNumber,
    label: 'Afficher le round suivant',
    events: [instrumentRoundVisibilityChanged({ instrumentId, visibleRoundCount })],
  });
}

export function buildAddHoleTransaction({ jamId, clientId, clientSequenceNumber, instrumentId, appearanceIndex, afterCard = null, beforeCard = null }) {
  const holeId = createId('hole');
  return createTransaction({
    jamId,
    clientId,
    clientSequenceNumber,
    label: 'Ajouter un trou',
    events: [holeAdded({
      holeId,
      instrumentId,
      appearanceIndex,
      reason: 'manual',
      afterTarget: toTarget(afterCard),
      beforeTarget: toTarget(beforeCard),
      positionKey: `position_${holeId}`,
    })],
  });
}

export function buildAddParticipantTransaction({ jamId, clientId, clientSequenceNumber, instrumentId, appearanceIndex, afterCard = null, beforeCard = null }) {
  const participantId = createId('participant');
  const participationId = createId('participation');
  return createTransaction({
    jamId,
    clientId,
    clientSequenceNumber,
    label: 'Ajouter un participant',
    events: [
      participantCreated({ participantId, name: 'Nouveau participant' }),
      participationAdded({
        participationId,
        participantId,
        instrumentId,
        customInstrumentLabel: null,
        insertionMode: afterCard || beforeCard ? 'between_targets' : 'end_of_visible_rounds',
        startAppearanceIndex: appearanceIndex,
        afterTarget: toTarget(afterCard),
        beforeTarget: toTarget(beforeCard),
        baseOrderKey: `position_${participationId}`,
      }),
    ],
  });
}

export function buildTogglePlateauPlayedTransaction({ jamId, clientId, clientSequenceNumber, plateauIndex, targets, played }) {
  const event = played
    ? plateauUnplayed({ plateauIndex, targets })
    : plateauPlayed({ plateauIndex, targets, playedAt: new Date().toISOString() });
  return createTransaction({
    jamId,
    clientId,
    clientSequenceNumber,
    label: played ? 'Annuler plateau joué' : 'Marquer plateau joué',
    events: [event],
  });
}
