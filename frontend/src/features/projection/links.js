export function normalizeTarget(target) {
  if (!target) return null;
  return {
    type: target.type ?? target.targetType,
    id: target.id ?? target.targetId,
  };
}

export function targetKey(target) {
  const normalized = normalizeTarget(target);
  return normalized ? `${normalized.type}:${normalized.id}` : null;
}

export function linkTargets(link) {
  return (link.targets ?? []).map(normalizeTarget).filter(Boolean);
}

export function isTargetInLink(link, target) {
  const key = targetKey(target);
  return Boolean(key && linkTargets(link).some((candidate) => targetKey(candidate) === key));
}

export function removeLinksTargeting(state, target) {
  Object.values(state.links).forEach((link) => {
    if (!link.removed && isTargetInLink(link, target)) {
      link.removed = true;
    }
  });
}

export function activeLinksForTarget(state, target) {
  return Object.values(state.links).filter((link) => !link.removed && isTargetInLink(link, target));
}

export function isLinked(state, target) {
  return activeLinksForTarget(state, target).length > 0;
}

function entityForTarget(state, target) {
  const normalized = normalizeTarget(target);
  if (!normalized) return null;
  return normalized.type === 'hole' ? state.holes[normalized.id] : state.appearances[normalized.id];
}

function numericOrder(entity) {
  const value = Number.parseFloat(entity?.orderKey ?? entity?.positionKey);
  return Number.isFinite(value) ? value : null;
}

function linkedOrder(orders, strategy) {
  const numericOrders = orders.filter((order) => order !== null);
  if (numericOrders.length === 0) return null;
  if (strategy === 'move_to_last') return Math.max(...numericOrders);
  if (strategy === 'average_position') return numericOrders.reduce((sum, order) => sum + order, 0) / numericOrders.length;
  return Math.min(...numericOrders);
}

export function applyLinkReordering(state) {
  for (const link of Object.values(state.links)) {
    if (link.removed) continue;
    const targets = linkTargets(link);
    const entities = targets.map((target) => entityForTarget(state, target)).filter(Boolean);
    if (entities.length < 2) continue;
    const order = linkedOrder(entities.map(numericOrder), link.reorderStrategy ?? state.jam?.linkReorderStrategy ?? 'move_to_first');
    if (order === null) continue;
    for (const entity of entities) {
      entity.orderKey = String(order);
      entity.positionKey = String(order);
    }
  }
  return state;
}
