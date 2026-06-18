export function cardLinks(card, links) {
  return Object.values(links ?? {}).filter((link) => link.status === 'active' && link.suppressedByConflict !== true && link.suppressedBySameColumn !== true && link.targets.some((target) => target.type === card.type && target.id === card.id));
}

export function cardConflicts(card, conflicts) {
  return Object.values(conflicts ?? {}).filter((conflict) => conflict.status === 'active' && conflict.suppressedBySameColumn !== true && conflict.targetIds.includes(card.id));
}

export function participantHasPlayed(projection, participantId) {
  return Object.values(projection.appearances ?? {}).some((appearance) => appearance.participantId === participantId && appearance.played);
}

export function canDragCard(card, projection) {
  if (!card || card.played || card.locked) return false;
  return cardConflicts(card, projection.conflicts).length === 0;
}
