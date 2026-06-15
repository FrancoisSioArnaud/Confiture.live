import { conflictCreated, conflictRemoved, appearanceMovedBetween } from '../../transactions/eventFactories';
import { createTransaction } from '../../transactions/createTransaction';
import { createId } from '../../../shared/utils/createId';

export function activeConflictsBetween(anchorCard, targetCard, conflicts) {
  return Object.values(conflicts ?? {}).filter((conflict) => {
    if (conflict.status !== 'active') return false;
    const ids = conflict.scope === 'participation' ? [anchorCard.participationId, targetCard.participationId] : [anchorCard.id, targetCard.id];
    return ids.every((id) => conflict.targetIds.includes(id));
  });
}

export function buildConflictModeTransaction({ jamId, clientId, clientSequenceNumber, projection, anchorCard, targetCard, scope, moveTarget = null }) {
  const existing = activeConflictsBetween(anchorCard, targetCard, projection.conflicts);
  const events = existing.map((conflict) => conflictRemoved({ conflictId: conflict.conflictId }));
  if (existing.length === 0) {
    const targetIds = scope === 'participation' ? [anchorCard.participationId, targetCard.participationId] : [anchorCard.id, targetCard.id];
    events.push(conflictCreated({
      conflictId: createId('conflict'),
      scope,
      targetIds,
      reason: 'manual',
      anchorTargetId: scope === 'participation' ? anchorCard.participationId : anchorCard.id,
    }));
    if (moveTarget) {
      events.push(appearanceMovedBetween({
        appearanceId: moveTarget.card.id,
        instrumentId: moveTarget.card.instrumentId,
        afterTarget: moveTarget.afterCard ? { type: moveTarget.afterCard.type, id: moveTarget.afterCard.id } : null,
        beforeTarget: moveTarget.beforeCard ? { type: moveTarget.beforeCard.type, id: moveTarget.beforeCard.id } : null,
        movedLinkedGroup: false,
      }));
    }
  }
  if (events.length === 0) return null;
  return createTransaction({ jamId, clientId, clientSequenceNumber, label: existing.length > 0 ? 'Retirer conflit' : 'Créer conflit', events });
}
