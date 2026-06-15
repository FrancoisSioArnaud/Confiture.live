export function addConflict(state, payload) {
  state.conflicts[payload.conflictId] = {
    id: payload.conflictId,
    conflictId: payload.conflictId,
    scope: payload.scope,
    targetIds: [...payload.targetIds],
    reason: payload.reason,
    anchorTargetId: payload.anchorTargetId,
    status: 'active',
  };
  separateConflictTargets(state, state.conflicts[payload.conflictId]);
}

export function removeConflict(state, conflictId) {
  if (state.conflicts[conflictId]) state.conflicts[conflictId].status = 'removed';
}

export function hasConflictBetweenTargets(state, targets) {
  const ids = targets.flatMap((target) => {
    const entity = target.type === 'appearance' ? state.appearances[target.id] : state.holes[target.id];
    return [target.id, entity?.participationId].filter(Boolean);
  });
  return Object.values(state.conflicts).some((conflict) => conflict.status === 'active' && conflict.targetIds.every((id) => ids.includes(id)));
}

function separateConflictTargets(state, conflict) {
  const targetEntities = conflict.targetIds.map((id) => resolveConflictTarget(state, conflict.scope, id)).filter(Boolean);
  if (targetEntities.length < 2) return;
  const anchor = resolveConflictTarget(state, conflict.scope, conflict.anchorTargetId) ?? targetEntities[0];
  targetEntities.forEach((entity) => {
    if (entity.id === anchor.id || entity.locked || entity.played) return;
    if (entity.orderScore === anchor.orderScore) entity.orderScore += 1;
  });
}

function resolveConflictTarget(state, scope, id) {
  if (scope === 'appearance') return state.appearances[id];
  const participation = state.participations[id];
  if (!participation) return null;
  return Object.values(state.appearances).find((appearance) => appearance.participationId === participation.participationId && appearance.status !== 'removed') ?? null;
}
