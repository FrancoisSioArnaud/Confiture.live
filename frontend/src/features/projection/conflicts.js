export function activeConflicts(state) {
  return Object.values(state.conflicts).filter((conflict) => !conflict.removed);
}

export function conflictsForTarget(state, { scope, id }) {
  return activeConflicts(state).filter((conflict) => conflict.scope === scope && (conflict.targetIds ?? []).includes(id));
}

export function hasConflictBetween(state, { scope, firstId, secondId }) {
  return activeConflicts(state).some((conflict) => {
    const targets = conflict.targetIds ?? [];
    return conflict.scope === scope && targets.includes(firstId) && targets.includes(secondId);
  });
}
