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
}

export function removeConflict(state, conflictId) {
  if (state.conflicts[conflictId]) state.conflicts[conflictId].status = 'removed';
}

export function hasConflictBetweenTargets(state, targets) {
  const ids = targets.flatMap((target) => {
    const entity = target.type === 'appearance' ? state.appearances[target.id] : state.holes[target.id];
    return [target.id, entity?.participationId].filter(Boolean);
  });
  return Object.values(state.conflicts).some((conflict) => conflict.status === 'active' && conflict.suppressedBySameColumn !== true && conflict.targetIds.every((id) => ids.includes(id)));
}

export function resolveConflictTarget(state, scope, id) {
  return resolveConflictTargets(state, scope, id)[0] ?? null;
}

export function resolveConflictTargets(state, scope, id) {
  if (scope === 'appearance') {
    return [state.appearances[id] ?? state.holes[id] ?? null].filter(Boolean);
  }
  const participation = state.participations[id];
  if (!participation) return [];
  return Object.values(state.appearances)
    .filter((appearance) => appearance.participationId === participation.participationId && appearance.status !== 'removed')
    .sort((a, b) => {
      const round = (a.appearanceIndex ?? 1) - (b.appearanceIndex ?? 1);
      if (round !== 0) return round;
      return String(a.id).localeCompare(String(b.id));
    });
}
