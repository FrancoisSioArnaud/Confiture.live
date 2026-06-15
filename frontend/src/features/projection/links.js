import { hasConflictBetweenTargets } from './conflicts';
import { isLocked } from './locks';
import { getEntityOrder } from './ordering';
import { isPlayed } from './played';
import { getTargetEntity } from './holes';

function nextLinkedOrder(targets, strategy) {
  const values = targets.map(getEntityOrder);
  if (strategy === 'move_to_last') return Math.max(...values);
  if (strategy === 'average_position') return values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.min(...values);
}

export function addLink(state, payload) {
  const link = {
    id: payload.linkId,
    linkId: payload.linkId,
    targets: payload.targets.map((target) => ({ ...target })),
    anchorTarget: { ...payload.anchorTarget },
    reorderStrategy: payload.reorderStrategy ?? state.jam?.linkReorderStrategy ?? 'move_to_first',
    status: 'active',
    suppressedByConflict: false,
  };
  state.links[payload.linkId] = link;
  applyLink(state, link);
}

export function removeLink(state, linkId) {
  if (state.links[linkId]) state.links[linkId].status = 'removed';
}

export function applyLink(state, link) {
  if (link.status !== 'active') return;
  const entities = link.targets.map((target) => getTargetEntity(state, target)).filter(Boolean);
  if (entities.length < 2 || hasConflictBetweenTargets(state, link.targets)) {
    link.suppressedByConflict = true;
    return;
  }
  const order = nextLinkedOrder(entities, link.reorderStrategy);
  link.targets.forEach((target) => {
    const entity = getTargetEntity(state, target);
    if (entity && !isLocked(state, target) && !isPlayed(state, target)) entity.orderScore = order;
  });
}

export function reapplyActiveLinks(state) {
  Object.values(state.links).forEach((link) => applyLink(state, link));
}
