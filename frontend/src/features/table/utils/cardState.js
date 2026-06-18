function isUsableActiveLink(link) {
  return link.status === 'active' && link.suppressedByConflict !== true && link.suppressedBySameColumn !== true;
}

function isUsableActiveConflict(conflict) {
  return conflict.status === 'active' && conflict.suppressedBySameColumn !== true;
}

export function cardLinks(card, links) {
  return Object.values(links ?? {}).filter((link) => isUsableActiveLink(link) && link.targets.some((target) => target.type === card.type && target.id === card.id));
}

export function cardConflicts(card, conflicts) {
  const ids = [card.id, card.appearanceId, card.holeId, card.participationId].filter(Boolean);
  return Object.values(conflicts ?? {}).filter((conflict) => isUsableActiveConflict(conflict) && conflict.targetIds.some((targetId) => ids.includes(targetId)));
}

export function participantHasPlayed(projection, participantId) {
  return Object.values(projection.appearances ?? {}).some((appearance) => appearance.participantId === participantId && appearance.played);
}

export function canDragCard(card) {
  return Boolean(card) && !card.played && !card.locked;
}
