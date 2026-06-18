import { conflictCreated, conflictRemoved } from '../../transactions/eventFactories';
import { createTransaction } from '../../transactions/createTransaction';
import { createId } from '../../../shared/utils/createId';

function isUsableActiveConflict(conflict) {
  return conflict.status === 'active' && conflict.suppressedBySameColumn !== true;
}

function sameColumn(anchorCard, targetCard) {
  return Boolean(anchorCard?.instrumentId && targetCard?.instrumentId && anchorCard.instrumentId === targetCard.instrumentId);
}

export function activeConflictsBetween(anchorCard, targetCard, conflicts) {
  return Object.values(conflicts ?? {}).filter((conflict) => {
    if (!isUsableActiveConflict(conflict)) return false;
    const ids = conflict.scope === 'participation' ? [anchorCard.participationId, targetCard.participationId] : [anchorCard.id, targetCard.id];
    return ids.every((id) => conflict.targetIds.includes(id));
  });
}

export function buildConflictModeTransaction({ jamId, clientId, clientSequenceNumber, projection, anchorCard, targetCard, scope }) {
  if (!anchorCard || !targetCard || sameColumn(anchorCard, targetCard)) return null;
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
  }
  if (events.length === 0) return null;
  return createTransaction({ jamId, clientId, clientSequenceNumber, label: existing.length > 0 ? 'Retirer conflit' : 'Créer conflit', events });
}
