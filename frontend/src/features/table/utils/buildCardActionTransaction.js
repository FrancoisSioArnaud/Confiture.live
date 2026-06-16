import {
  appearanceLocked,
  appearanceMovedBetween,
  appearanceRemoved,
  appearanceUnlocked,
  holeLocked,
  holeMovedBetween,
  holeRemoved,
  holeUnlocked,
  participantMarkedLeft,
  participantRemoved,
} from '../../transactions/eventFactories';
import { createTransaction } from '../../transactions/createTransaction';

function toTarget(card) {
  if (!card) return null;
  return { type: card.type, id: card.id };
}

export function buildToggleLockTransaction({ jamId, clientId, clientSequenceNumber, card }) {
  const event = card.type === 'hole'
    ? (card.locked ? holeUnlocked({ holeId: card.id }) : holeLocked({ holeId: card.id }))
    : (card.locked ? appearanceUnlocked({ appearanceId: card.id }) : appearanceLocked({ appearanceId: card.id }));
  return createTransaction({ jamId, clientId, clientSequenceNumber, label: card.locked ? 'Déverrouiller passage' : 'Verrouiller passage', events: [event] });
}

export function buildRemoveCardTransaction({ jamId, clientId, clientSequenceNumber, card, linked = false }) {
  if (card.locked || card.played) return null;
  const event = card.type === 'hole'
    ? holeRemoved({ holeId: card.id, confirmedDespiteLink: linked })
    : appearanceRemoved({ appearanceId: card.id, confirmedDespiteLink: linked });
  return createTransaction({ jamId, clientId, clientSequenceNumber, label: card.type === 'hole' ? 'Supprimer le trou' : 'Supprimer le passage', events: [event] });
}

export function buildMoveCardTransaction({ jamId, clientId, clientSequenceNumber, card, instrumentId, afterCard = null, beforeCard = null, movedLinkedGroup = false }) {
  if (card.locked || card.played) return null;
  const payload = { instrumentId, afterTarget: toTarget(afterCard), beforeTarget: toTarget(beforeCard), movedLinkedGroup };
  const event = card.type === 'hole'
    ? holeMovedBetween({ holeId: card.id, ...payload })
    : appearanceMovedBetween({ appearanceId: card.id, ...payload });
  return createTransaction({ jamId, clientId, clientSequenceNumber, label: 'Déplacer passage', events: [event] });
}

export function buildParticipantLeftTransaction({ jamId, clientId, clientSequenceNumber, participantId }) {
  return createTransaction({
    jamId,
    clientId,
    clientSequenceNumber,
    label: 'Marquer musicien parti',
    events: [participantMarkedLeft({ participantId, confirmedDespiteFutureLockedAppearances: true })],
  });
}

export function buildRemoveParticipantTransaction({ jamId, clientId, clientSequenceNumber, participantId }) {
  return createTransaction({
    jamId,
    clientId,
    clientSequenceNumber,
    label: 'Supprimer participant',
    events: [participantRemoved({ participantId })],
  });
}
