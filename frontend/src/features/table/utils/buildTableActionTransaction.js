import {
  instrumentRoundVisibilityChanged,
  plateauPlayed,
  plateauUnplayed,
} from '../../transactions/eventFactories';
import { createTransaction } from '../../transactions/createTransaction';

export function buildRevealRoundTransaction({ jamId, clientId, clientSequenceNumber, instrumentId, visibleRoundCount }) {
  return createTransaction({
    jamId,
    clientId,
    clientSequenceNumber,
    label: 'Afficher le round suivant',
    events: [instrumentRoundVisibilityChanged({ instrumentId, visibleRoundCount })],
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
